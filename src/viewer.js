/**
 * @constructor
 * @augments EventDispatcher
 * @param {HTMLCanvasElement} canvas
 */
function ModelViewer(canvas) {
    EventDispatcher.call(this);

    /** @member {object} */
    this.resources = {
        models: {
            array: [],
            map: new Map()
        },

        textures: {
            array: [],
            map: new Map()
        },

        files: {
            array: [],
            map: new Map()
        }
    };

    /** 
     * The speed of animation. Note that this is not the time of a frame in milliseconds, but rather the amount of animation frames to advance each update.
     * 
     * @member {number} 
     */
    this.frameTime = 1000 / 60;

    /** @member {HTMLCanvasElement} */
    this.canvas = canvas;

    /** @member {WebGL} */
    this.webgl = new WebGL(canvas);

    /** @member {WebGLRenderingContext} */
    this.gl = this.webgl.gl;

    /** @member {Object<string, string>} */
    this.sharedShaders = {
        // Shared shader code to mimic gl_InstanceID
        "instanceId": `
            attribute float a_InstanceID;
        `,
        // Shared shader code to handle bone textures
        "boneTexture": `
            uniform sampler2D u_boneMap;
            uniform float u_vector_size;
            uniform float u_row_size;

            mat4 boneAtIndex(float column, float row) {
                column *= u_vector_size * 4.0;
                row *= u_row_size;

                return mat4(texture2D(u_boneMap, vec2(column, row)),
                            texture2D(u_boneMap, vec2(column + u_vector_size, row)),
                            texture2D(u_boneMap, vec2(column + u_vector_size * 2.0, row)),
                            texture2D(u_boneMap, vec2(column + u_vector_size * 3.0, row)));
            }
            `,
        // Shared shader code to handle decoding multiple bytes stored in floats
        "decodeFloat": `
            vec2 decodeFloat2(float f) {
                vec2 v;

                v[1] = floor(f / 256.0);
                v[0] = floor(f - v[1] * 256.0);

                return v;
            }

            vec3 decodeFloat3(float f) {
                vec3 v;

                v[2] = floor(f / 65536.0);
                v[1] = floor((f - v[2] * 65536.0) / 256.0);
                v[0] = floor(f - v[2] * 65536.0 - v[1] * 256.0);

                return v;
            }
        `
    };

    /** @member {Map<string, Handler>} */
    this.handlers = new Map(); // Map from a file extension to an handler

    /** @member {Array<Scene>} */
    this.scenes = [];

    /** @member {number} */
    this.resourcesLoading = 0;
    this.addEventListener("loadstart", () => this.resourcesLoading += 1);
    this.addEventListener("loadend", () => this.resourcesLoading -= 1);
}

ModelViewer.prototype = {
    /**
     * Add an handler.
     * 
     * @param {Handler} handler The handler to add.
     * @returns {boolean}
     */
    addHandler(handler) {
        if (handler) {
            let objectType = handler.objectType;

            if (objectType === "modelhandler" || objectType === "texturehandler" || objectType === "filehandler") {
                let handlers = this.handlers,
                    extensions = handler.extension.split("|");

                // Check to see if this handler was added already.
                if (!handlers.has(extensions[0])) {
                    // Run the global initialization function of the handler.
                    // If it returns true, to signifiy everything worked correctly, add the handler to the handlers map.
                    if (handler.initialize(this)) {
                        // Add each of the handler's extensions to the handler map.
                        for (let extension of extensions) {
                            handlers.set(extension, handler);
                        }

                        return true;
                    } else {
                        this.dispatchEvent({ type: "error", error: "InvalidHandler", extra: "FailedToInitalize" });
                    }
                }
            } else {
                this.dispatchEvent({ type: "error", error: "InvalidHandler", extra: "UnknownHandlerType" });
            }
        }

        return false;
    },

    /**
     * Add a scene.
     * 
     * @param {Scene} scene The scene to add.
     * @returns {boolean}
     */
    addScene(scene) {
        if (scene && scene.objectType === "scene") {
            let scenes = this.scenes,
                index = scenes.indexOf(scene);

            if (index === -1) {
                scenes.push(scene);

                scene.env = this;

                return true;
            }
        }

        return false;
    },

    /**
     * Remove a scene.
     * 
     * @param {Scene} scene The scene to remove.
     * @returns {boolean}
     */
    removeScene(scene) {
        if (scene && scene.objectType === "scene") {
            let scenes = this.scenes,
                index = scenes.indexOf(scene);

            if (index !== -1) {
                scenes.splice(index, 1);

                scene.env = null;

                return true;
            }
        }

        return false;
    },

    /**
     * Removes all of the scenes in the viewer.
     */
    clear() {
        let scenes = this.scenes;

        for (let i = 0, l = scenes.length; i < l; i++) {
            this.removeScene(scenes[i]);
        }
    },

    /**
     * The amount of WebGL render calls being made each time the viewer is rendered.
     */
    renderCalls() {
        let scenes = this.scenes,
            count = 0;

        for (let i = 0, l = scenes.length; i < l; i++) {
            count += scenes[i].renderCalls();
        }

        return count;
    },

    /**
     * The amount of instances being rendered each time the viewer is being rendered.
     */
    renderedInstances() {
        let scenes = this.scenes,
            count = 0;

        for (let i = 0, l = scenes.length; i < l; i++) {
            count += scenes[i].renderedInstances();
        }

        return count;
    },

    /**
     * The amount of triangles rendered each time the viewer is rendered.
     * This includes emitters.
     */
    renderedPolygons() {
        let scenes = this.scenes,
            count = 0;

        for (let i = 0, l = scenes.length; i < l; i++) {
            count += scenes[i].renderedPolygons();
        }

        return count;
    },

    /**
     * Load something. The meat of this whole project.
     * 
     * @param {?} src The source used for the load.
     * @param {function(?)} pathSolver The path solver used by this load, and any subsequent loads that are caused by it (for example, a model that loads its textures).
     * @returns {AsyncResource}
     */
    load(src, pathSolver) {
        if (src) {
            let extension,
                serverFetch;

            // Built-in texture source
            if (src instanceof HTMLImageElement || src instanceof HTMLVideoElement || src instanceof HTMLCanvasElement || src instanceof ImageData || src instanceof WebGLTexture) {
                extension = ".png";
                serverFetch = false;
            } else {
                [src, extension, serverFetch] = pathSolver(src);
            }

            let handler = this.handlers.get(extension.toLowerCase());

            // Is there an handler for this file type?
            if (handler) {
                let pair = this.pairFromType(handler.objectType),
                    map = pair.map;
                
                // Only construct the resource if the source was not already loaded.
                if (!map.has(src)) {
                    let resource = new handler.Constructor(this, pathSolver);

                    // Cache the resource
                    map.set(src, resource);
                    pair.array.push(resource);

                    // Register the standard events.
                    this.registerEvents(resource);

                    // Tell the resource to actually load itself
                    resource.load(src, handler.binaryFormat, serverFetch);
                }

                // Get the resource from the cache.
                return map.get(src);
            } else {
                this.dispatchEvent({ type: "error", error: "MissingHandler", extra: [src, extension, serverFetch] });
            }
        }
    },

    /**
     * Calls the given callback when all of the given resources finished loading. In the case all of the resources are already loaded, the call happens immediately.
     * 
     * @param {Array<AsyncResource>} resources The resources to wait for.
     * @param {function(Array<AsyncResource>)} callback The callback.
     */
    whenLoaded(resources, callback) {
        let loaded = 0,
            wantLoaded = resources.length;

        function gotLoaded() {
            loaded += 1;

            if (loaded === wantLoaded) {
                callback(resources);
            }
        }

        for (let i = 0; i < wantLoaded; i++) {
            let resource = resources[i];

            if (this.isResource(resource)) {
                resource.whenLoaded(gotLoaded);
            } else {
                wantLoaded -= 1;
            }
            
        }
    },

    /**
     * Calls the given callback when all of the viewer resources finished loading. In the case all of the resources are already loaded, the call happens immediately.
     * Note that instances are also counted.
     * 
     * @param {function(ModelViewer)} callback The callback.
     */
    whenAllLoaded(callback) {
        if (this.resourcesLoading === 0) {
            callback(this);
        } else {
            // Self removing listener
            let listener = () => { if (this.resourcesLoading === 0) { this.removeEventListener("loadend", listener); callback(this); } };

            this.addEventListener("loadend", listener);
        }
    },

    /**
     * Remove a resource from the viewer.
     * Note that this only removes references to this resource, so your code should do the same, to allow GC to work.
     * This also means that if a resource is referenced by another resource, it is not going to be GC'd.
     * For example, deleting a texture that is being used by a model will not actually let the GC to collect it, until the model is deleted too, and loses all references.
     * 
     * @param {AsyncResource} resource
     */
    removeResource(resource) {
        if (this.removeReference(resource)) {
            // Tell the resource to detach itself
            resource.detach();
        }
    },

    /**
     * Checks if a given object is a resource of the viewer.
     * This is done by checking the object's objectType field.
     * 
     * @param {*} object The object to check.
     * @returns {boolean}
     */
    isResource(object) {
        if (object) {
            let objectType = object.objectType;

            return objectType === "model" || objectType === "texture" || objectType === "file";
        }

        return false;
    },

    /**
     * Gets a Blob object representing the canvas, and calls the callback with it.
     * 
     * @param {function(Blob)} callback The callback to call.
     */
    toBlob(callback) {
        // Render to ensure the internal WebGL buffer is valid.
        // I am not sure if this is needed.
        this.render();

        this.canvas.toBlob((blob) => callback(blob));
    },

    /**
     * Update and render a frame.
     */
    updateAndRender() {
        this.update();
        this.render();
    },

    /**
     * Update.
     */
    update() {
        let resources = this.resources,
            objects;

        // While one of the base resources could theoretically need updating, so far this was never the case.
        // For now, I'll just comment this to reduce needless iteration.
        /*
        // Update all of the models.
        objects = resources.models.array;
        for (let i = 0, l = objects.length; i < l; i++) {
            objects[i].update();
        }

        // Update all of the textures.
        objects = resources.textures.array;
        for (let i = 0, l = objects.length; i < l; i++) {
            objects[i].update();
        }

        // Update all of the generic files.
        objects = resources.files.array;
        for (let i = 0, l = objects.length; i < l; i++) {
            objects[i].update();
        }
        */

        // Update all of the scenes.
        objects = this.scenes;
        for (let i = 0, l = objects.length; i < l; i++) {
            objects[i].update();
        }
    },

    /**
     * Render.
     */
    render() {
        let gl = this.gl,
            scenes = this.scenes,
            i,
            l = scenes.length;

        // See https://www.opengl.org/wiki/FAQ#Masking
        gl.depthMask(1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        for (i = 0; i < l; i++) {
            scenes[i].renderOpaque();
        }

        for (i = 0; i < l; i++) {
            scenes[i].renderTranslucent();
        }

        for (i = 0; i < l; i++) {
            scenes[i].renderEmitters();
        }

        this.dispatchEvent({ type: "render" })
    },

    // Removes the reference pair of this resource.
    removeReference(resource) {
        if (this.isResource(resource)) {
            let objectType = resource.objectType,
                pair = this.pairFromType(objectType);

            // Find the resource in the array and splice it.
            pair.array.delete(resource);

            // Find the resource in the map and delete it.
            pair.map.deleteValue(resource);

            return true;
        }

        return false;
    },

    // Register the viewer to all of the standard events of a resource.
    registerEvents(resource) {
        let listener = (e) => this.dispatchEvent(e);

        ["loadstart", "load", "loadend", "error", "progress"].map((e) => resource.addEventListener(e, listener));
    },

    // Used to easily get the resources object from an object type.
    pairFromType(objectType) {
        if (objectType === "model" || objectType === "modelhandler") {
            return this.resources.models;
        } else if (objectType === "texture" || objectType === "texturehandler") {
            return this.resources.textures;
        } else if (objectType === "file" || objectType === "filehandler") {
            return this.resources.files;
        }
    }
};

mix(ModelViewer.prototype, EventDispatcher.prototype);
