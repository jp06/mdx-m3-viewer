**NO LONGER ACTIVELY MAINTAINED.**

mdx-m3-viewer
=============

At the core of it, a 3D model viewer for MDX and M3 models used by the games Warcraft 3 and Starcraft 2 respectively.

The viewer part handles the following formats:
* MDX (Warcraft 3 model): extensive support, almost everything should work.
* M3 (Starcraft 2 model): partial support.
* W3M/W3X (Warcraft 3 map): partial support.
* BLP1 (Warcraft 3 texture): extensive support, almost everything should work.
* TGA (image): partial support, only simple 24bit images.
* DDS (compressed texture): partial support - DXT1/DXT3/DXT5/RGTC.
* PNG/JPG/GIF/WebP: supported by the browser.

There are file parsers that the viewer depends on.\
These don't rely on the viewer or indeed on even running in a browser.\
They include:
* MDX/MDL: read/write.
* M3: read.
* BLP1: read.
* INI: read.
* SLK: read.
* MPQ1: read/write.
* W3M/W3X/W3N: read/write, including all of the internal files.
* DDS: read (DXT1/DXT3/DXT5/RGTC).

There are all sorts of utilities that were made over the years.\
These include things like...
* The library's unit tester, which compares rendered results against stored images that were generated in the same way.
* The MDX sanity test, which looks for errors and weird things in MDX models.
* A Jass context that can...well, run Jass code. That being said, it really runs Lua code converted from Jass, on a JS Lua VM. What a tongue twiser. While it supports some Warcraft 3 natives, don't expect it run whole maps. Maybe in the future 😉
* A utility that makes it possible to open Warcraft 3 maps in the vanilla World Editor, in cases were said maps used a non-vanilla editor with extended GUI, in which case they crash upon opening in the official editor.
* etc.

Finally, the library also comes with a bunch of clients.\
A "client" in this context means external code that uses the library.\
Most of these clients are simple and messy, since they were made as side projects while working on the library.\
Most of these clients are also just wrappers around the viewer and the utilities, merely giving them an interface on a web page.\
These include things like...
* A simple example client.
* The unit tester's page, which allows to run the unit tests, and to download the results.
* The MDX sanity test's page, which visually shows the results of sanity tests, and other nifty things.
* etc.

------------------------

#### Building

```
npm install mdx-m3-viewer
npm run build
```
This will generate `dist/viewer.min.js`.

If you are using Typescript, you can also import anything in the library directly.\
For example, if you only care about an MDX viewer, you could do the following:
```javascript
import ModelViewer from 'mdx-m3-viewer/src/viewer/viewer';
import mdxHandler from 'mdx-m3-viewer/src/viewer/handlers/mdx/handler';
```
This way, you don't import any parsers/handlers/utilities that are not needed.

------------------------

#### Getting started

1. Run the given demo HTTP server `npm run serve`.
2. In your browser, open `http://localhost/clients/example`.
3. You can also check the other more advanced clients.

------------------------

#### Usage

You can import the viewer in different ways:
```javascript
// webpack export in the browser.
new ModelViewer.default.viewer.ModelViewer(canvas);

// require/import the library.
const ModelViewer = require('mdx-m3-viewer'); // CommonJS.
import ModelViewer from 'mdx-m3-viewer'; // ES6.
new ModelViewer.viewer.ModelViewer(canvas);

// require/import something directly.
const ModelViewer = require('mdx-m3-viewer/src/viewer/viewer'); // CommonJS.
import ModelViewer from 'mdx-m3-viewer/src/viewer/viewer'; // ES6.
new ModelViewer(canvas);

```

All code snippets will use the names as if you imported them directly to avoid some mess. See the examples for actual namespacing.

First, let's create the viewer:
```javascript
let canvas = ...; // A <canvas> aka HTMLCanvasElement object.

let viewer = new ModelViewer(canvas);
```

If the client doesn't have the WebGL requierments to run the viewer, an exception will be thrown when trying to create it.

Now that we have a viewer, a scene can be created.
Each scene has its own camera and viewport, and holds a list of things to update and render.
```javascript
let scene = viewer.addScene();

// While we're at it, might as well move the camera backwards a bit, so we can actually see the origin.
scene.camera.move([0, 0, 500]);
```

Finally, we need to actually let the viewer update and render:
```javascript
(function step() {
  requestAnimationFrame(step);

  viewer.updateAndRender();
}());
```

---

Models and textures are loaded with the `load` function.

To load models and textures with `load`, the viewer must have handlers that tell it how to load the different file formats.\
If you want to load an MDX model, the MDX handler must be added to the viewer, and so on.\
This is done with the `addHandler` function, and the different handlers are exported as a part of the library.

Let's add the MDX and BLP handlers:
```javascript
viewer.addHandler(handlers.mdx);
viewer.addHandler(handlers.blp);
```

Now MDX (and MDL) and BLP files will be accepted by the viewer.

Suppose we have the following directory structure, where `model.mdx` uses `texture.blp`:

```
├── index.html
└── Resources
    ├── model.mdx
    └── texture.blp
```

Loading the model is simple:
```javascript
let modelPromise = viewer.load("Resources/model.mdx");
```

You get back a promise, which will resolve to either the MDX model, or to undefined if any error occured.

When the MDX file loads, it also loads internal resources, like its textures, so the viewer will attempt to fetch `texture.blp`.\
If the server knows that is a path relative to `Resources/` then all is fine.\
It is a lot easier and more dynamic to control the paths on the client though.\
This is done with "path solvers" - functions that, given a source to load from, such as a path, can modify it and return the actual source to load from.\
It will probably make more sense with code - let's call the load such that the texture is actually fetched from the correct path: `Resources/texture.blp`.
```javascript
function pathSolver(path) {
  return "Resources/" + path;
}

let modelPromise = viewer.load("model.mdx", pathSolver);
```

Here's the short version of what happens:

1. `pathSolver` is called with `"model.mdx"` and returns `"Resources/model.mdx"`.
2. The viewer starts the fetch, and emits the `loadstart` event.
3. A promise is returned.
4. ...time passes until the file finishes loading...
5. The viewer detects the format as MDX based on the file data (the url is irrelevant to this process).
6. The model is constructed successfuly, or not, with a `load` or `error` event sent respectively, followed by the `loadend` event.
7. In the case of an MDX model, the previous step will also cause it to load its textures.
8. `pathSolver` is called with `"texture.blp"`, which returns `"Resources/texture.blp"`, and we loop back to step 2, but with a texture this time.

Path solvers can return promises which will be waited upon, and they can return models and textures directly for injections.

Generally speaking, you'll need a simple path solver that expects urls and prepends them by some base directory or API url.\
There are however times when this is not the case, such as loading models with custom textures, and handling both in-memory and fetches in the same solver as done in the map viewer.

Once the promise is resolved, we have a model, however a model in this context is simply a source of data.\
The next step is to create an instance of this model.\
Instances can be rendered, moved, rotated, scaled, parented to other instances or nodes, play animations, and so on.
```javascript
let instance = model.addInstance();
```

And finally add the instance to the scene, so it's updated and rendered:
```javascript
instance.setScene(scene);
// Equivalent to:
scene.addInstance(instance);
```

---

Other resources, such as SLK tables and INI configurations, are loaded with `loadGeneric`.

```javascript
let resourcePromise = viewer.loadGeneric(path, dataType[, callback]);
```

Where:
* `path` is an url string.
* `dataType` is a string with one of these values: `text`, `arrayBuffer`, `blob`, or `image`.
* `callback` is an optional function that will be called with the data once the fetch is complete, and should return the resource's data.

If a callback is given, `resource.data` will be whatever the callback returns.\
If a promise is returned, the loader waits for it to resolve, and uses whatever it resolved to.\
If no callback is given, the data will be the fetch data itself, according to the given data type.

`loadGeneric` is a simple layer above the standard `fetch` function.\
The purpose of loading other files through the viewer is to cache the results and avoid multiple loads, while also allowing the viewer itself to handle events correctly.

------------------------

#### Events and Promises

As mentioned above, there are emitted events, and they can be used with the NodeJS EventEmitter API:
```javascript
viewer.on(eventName, listener)
viewer.off(eventName, listener)
viewer.once(eventName, listener)
viewer.emit(eventName[, ...args])
```

The built-in names are:
* `loadstart` - a resource started loading.
* `load` - a resource successfully loaded.
* `error` - something bad happened.
* `loadend` - a resource finished loading, follows both `load` and `error` when loading a resource.
* `idle` - all loads finished for now.

For example:
```javascript
viewer.on('error', (e) => console.log(e));
```

In addition there is `viewer.whenAllLoaded([callback])`, which can be used to run code when nothing is loading.
If a callback is given, it will be called, otherwise a promise is returned.
If there are no resources currently being loaded, this will happen instantly. Otherwise, it will happen once the `idle` event is emitted.

---

And now some more specific information and tips.

#### Team colors

When adding the MDX handler to the viewer, it attempts to load all of the team color and glow textures.

It uses `load` much like the client does, and thus the same implications apply - if the server is set for the relative paths, all is fine, otherwise a path solver should be used.

A path solver can be added when adding the handler:
```javascript
viewer.addHandler(handlers.mdx, teamColorsPathSolver);
```

The handler also selects between RoC/TFT (14) and Reforged (28) team colors.\
These will be used regardless of whether any specific model being rendered is a RoC/TFT or Reforged model.\
The default mode is RoC/TFT, and it can be changed by passing true as the third parameter when adding the handler:
```javascript
viewer.addHandler(handlers.mdx, teamColorsPathSolver, true); // Reforged team colors
```

Note that if you want to capture events for the team textures, add the event listeners before adding the handler.

#### Solver Params: Reforged and the map viewer

It is in fact possible to send more data to path solvers with `load`.
The full signature is as follows:
```javascript
let resourcePromise = viewer.load(src[, pathSolver[, solverParams]]);
```
Where `solverParams` can be anything.

When `solverParams` exists, it will be sent to the path solver as the second argument:
```javascript
function pathSolver(src, solverParams) {
  // ...
}
```

The MDX handler and the map viewer use `solverParams` to select between SD/HD Reforged resources, and to select specific tileset resources.

For example, let's suppose we want to load the Warcraft 3 Footman model, but with a twist - we want all three versions of it - RoC/TFT, Reforged SD, and Reforged HD.

The MDX handler defines the parameters as such: `{reforged?: boolean, hd?: boolean}`.\
The map viewer defines them as such: `{reforged?: boolean, hd?: boolean, tileset: string}`.

If `reforged` is falsy or doesn't exist, they want a TFT resource.\
If `reforged` is true, they want a Reforged SD resource and...\
If `hd` and `reforged` are true, they want a Reforged HD resource.

Following this, the loading code can be something along these lines:
```js
let TFT = viewer.load('Units/Human/Footman/Footman.mdx', mySolver);
let SD = viewer.load('Units/Human/Footman/Footman.mdx', mySolver, {reforged: true});
let HD = viewer.load('Units/Human/Footman/Footman.mdx', mySolver, {reforged: true, hd: true});
```

Note that you don't have to use these exact values.
Rather, these are the values that will be sent by the MDX handler or map viewer, when loading internal textures, models, and other files.

What does the path solver do, then?
As always, that depends on the client and the server.
For example, the client may append the parameters as url parameters, which can be seen in the existing clients.
The client can also completely ignore these parameters and return whatever resources it wants.

#### Starcraft 2 models are tiny

SC2 models are tiny compared to WC3 models.\
If a client needs models of both games to co-exist, it's suggested to scale SC2 models by 100.\
This can be done with something along the lines of:
```javascript
let instance = model.addInstance();

if (model instanceof handlers.m3.resource) {
  instance.uniformScale(100);
}
```

#### Loading resources from memory

Resources don't have to be fetched - if you have the data, you can load it directly.\
Nothing special is needed to be done, just return the data instead of an url.

For example, say a web page wants to load a model from a local file that is dragged into it.\
After some event handling, you end up with a `string` or an `ArrayBuffer`, let's call it `buffer`.\
We want to load `buffer`, but we know it's a model that uses `Resources/texture.blp`:
```javascript
function pathSolver(src) {
  if (src === buffer) {
    return src;
  }

  return "Resources/" + src;
}

viewer.load(buffer, pathSolver);
```

When `src` is the buffer we are loading, it will get loaded directly, otherwise - for internal textures - it will again resolve to `Resources/` correctly.

#### Primitive shapes

It is possible to construct primitive shapes with `createPrimitive`, which is available under `utils.mdx.createPrimitive`.

The function expects an object describing a primitive geometry, which can be obtained via the different functions in `utils.mdx.primitives`.

An optional material can be given, which can control the render mode between polygns and lines, the color, texture, and such.

For example:
```javascript
let modelPromise = createPrimitive(viewer, primitives.createUnitCube(), { color: [1, 0, 0] });
```

Note that this loads a standard MDX model which can be used like any other MDX model.

#### Sounds

MDX models have sound emitters, and the viewer supports them.

If sound is desired, `viewer.audioEnabled` should be set to true BEFORE loading models.\
This signals to the MDX handler that sound is desired, and it will load the neccessary sound files when loading models.\
If `audioEnabled` isn't true, the sound files aren't downloaded in the first place to reduce file fetching.

To get the sounds files to actually run, you must call `scene.enableAudio()`, which returns a promise that resolves to whether audio was actually enabled.\
There are two reasons for it to fail - either because the client simply does not support audio, or because the browser did not want to enable audio.\
The latter will happen if you attempt to enable audio before the user made any interaction with the page (like clicking something). This is a browser policy and there is no control over it.

If audio was enabled, you will hear familiar sounds when running animations, like attack sounds, death sounds, and so on.\
Not enough work was put into them to have the same feel as Warcraft 3, but it's sometimes a fun surprise to suddenly hear a model making sounds in the browser.

#### Scene composition

You can have any number of scenes you want.

Each scene offers the following to control how it's composed on the canvas:
* `viewport` - the position and size of the scene in pixels (defaults to the entire canvas).
* `alpha` - determines whether the scene has a background, or can be seen through (defaults to false - has a background).
* `color` - the background color, which is used when `alpha` is false (defaults to black).

```javascript
scene.viewport[0] = 100; // X offset from the left side of the canvas.
scene.viewport[1] = 100; // Y offset from the bottom side of the canvas.
scene.viewport[2] = 200; // Width.
scene.viewport[3] = 200; // Height.

scene.alpha = false; // Opaque, i.e. has a background (and also the default).

scene.color[0] = 1; // Red background.
scene.color[1] = 0;
scene.color[2] = 0;
```

The order in which the scenes are drawn is based on the order of creation, but you can manually move scenes around in `viewer.scenes`.

For example, let's say we want to mimic how Warcraft 3 looks. This could be done with 3 scenes:
1) The game world.
2) The UI with `alpha = true` so that where the UI isn't drawn, the game world will be seen through.
3) The selected portrait, moved and sized to be on the correct portion of the UI.

#### Overriding textures

MDX and M3 models allow to override the used textures per-instance.

Both have a `setTexture` function that takes the texture index, and a texture.

```javascript
instance.setTexture(0, myTexture); // Override texture 0.
instance.setTexture(0); // Remove the override.
```

MDX instances have also `setParticle2Texture` and `setEventTexture` to override the textures of particle emitters and event emitters respectively.

```javascript
instance.setParticle2Texture(0, myTexture); // Override the texture of particle emitter 0.
instance.setEventTexture(0, myTexture); // Override the texture of event emitter 0.
```
