import Parser from '../../../parsers/mdlx/model';
import Model from '../../model';
import TextureAnimation from './textureanimation';
import Layer from './layer';
import Material from './Material';
import GeosetAnimation from './geosetanimation';
import replaceableIds from './replaceableids';
import Bone from './bone';
import Light from './light';
import Helper from './helper';
import Attachment from './attachment';
import ParticleEmitterObject from './particleemitterobject';
import ParticleEmitter2Object from './particleemitter2object';
import RibbonEmitterObject from './ribbonemitterobject';
import Camera from './camera';
import EventObjectEmitterObject from './eventobjectemitterobject';
import CollisionShape from './collisionshape';
import setupGeosets from './setupgeosets';
import setupGroups from './setupgroups';

/**
 * An MDX model.
 */
export default class MdxModel extends Model {
  /**
   * @param {Object} resourceData
   */
  constructor(resourceData) {
    super(resourceData);

    this.hd = false;
    this.name = '';
    this.sequences = [];
    this.globalSequences = [];
    this.materials = [];
    this.layers = [];
    this.textures = [];
    this.textureAnimations = [];
    this.geosets = [];
    this.geosetAnimations = [];
    this.bones = [];
    this.lights = [];
    this.helpers = [];
    this.attachments = [];
    this.pivotPoints = [];
    this.particleEmitters = [];
    this.particleEmitters2 = [];
    this.ribbonEmitters = [];
    this.cameras = [];
    this.eventObjects = [];
    this.collisionShapes = [];

    this.hasLayerAnims = false;
    this.hasGeosetAnims = false;
    this.batches = [];

    this.genericObjects = [];
    this.sortedGenericObjects = [];
    this.hierarchy = [];
    this.replaceables = [];

    this.opaqueGroups = [];
    this.translucentGroups = [];

    this.variants = null;

    this.arrayBuffer = null;
    this.elementBuffer = null;
  }

  /**
   * @param {ArrayBuffer|string|Parser} bufferOrParser
   */
  load(bufferOrParser) {
    let parser;

    if (bufferOrParser instanceof Parser) {
      parser = bufferOrParser;
    } else {
      parser = new Parser(bufferOrParser);
    }

    this.name = parser.name;
    this.version = parser.version;

    // Initialize the bounds.
    let extent = parser.extent;
    this.bounds.fromExtents(extent.min, extent.max);

    // Sequences
    for (let sequence of parser.sequences) {
      this.sequences.push(sequence);
    }

    // Global sequences
    for (let globalSequence of parser.globalSequences) {
      this.globalSequences.push(globalSequence);
    }

    // Texture animations
    for (let textureAnimation of parser.textureAnimations) {
      this.textureAnimations.push(new TextureAnimation(this, textureAnimation));
    }

    // Materials
    let layerId = 0;
    for (let material of parser.materials) {
      let layers = [];

      for (let layer of material.layers) {
        let vLayer = new Layer(this, layer, layerId++, material.priorityPlane);

        layers.push(vLayer);
        this.layers.push(vLayer);

        if (vLayer.hasAnim) {
          this.hasLayerAnims = true;
        }
      }

      this.materials.push(new Material(this, material.shader, layers));

      if (material.shader !== '') {
        this.hd = true;
      }
    }

    let usingTeamTextures = false;

    // Textures
    for (let texture of parser.textures) {
      let path = texture.path;
      let replaceableId = texture.replaceableId;
      let flags = texture.flags;

      if (replaceableId !== 0) {
        path = `ReplaceableTextures\\${replaceableIds[replaceableId]}.blp`;

        if (replaceableId === 1 || replaceableId === 2) {
          usingTeamTextures = true;
        }
      }

      // If the path is corrupted, try to fix it.
      if (!path.endsWith('.blp') && !path.endsWith('.tga') && !path.endsWith('.dds')) {
        // Try to search for .blp
        let index = path.indexOf('.blp');

        if (index === -1) {
          // Not a .blp, try to search for .tga
          index = path.indexOf('.tga');

          if (index === -1) {
            index = path.indexOf('.dds');
          }
        }

        if (index !== -1) {
          // Hopefully fix the path
          path = path.slice(0, index + 4);
        }
      }

      if (this.version > 800 && !path.endsWith('.dds')) {
        path = path.slice(0, -4) + '.dds';
      }

      this.replaceables.push(replaceableId);

      let wrapS = !!(flags & 0x1);
      let wrapT = !!(flags & 0x2);

      if (this.hd) {
        path = `_hd.w3mod/${path}`;
      }

      this.textures.push(this.viewer.load(path, this.pathSolver, {wrapS, wrapT}));
    }

    if (usingTeamTextures) {
      // Start loading the team color and glow textures.
      this.loadTeamTextures();
    }

    // Geoset animations
    for (let geosetAnimation of parser.geosetAnimations) {
      this.geosetAnimations.push(new GeosetAnimation(this, geosetAnimation));
    }

    // Geosets
    setupGeosets(this, parser.geosets);

    this.pivotPoints = parser.pivotPoints;

    // Tracks the IDs of all generic objects.
    let objectId = 0;

    // Bones
    for (let bone of parser.bones) {
      this.bones.push(new Bone(this, bone, objectId++));
    }

    // Lights
    for (let light of parser.lights) {
      this.lights.push(new Light(this, light, objectId++));
    }

    // Helpers
    for (let helper of parser.helpers) {
      this.helpers.push(new Helper(this, helper, objectId++));
    }

    // Attachments
    for (let attachment of parser.attachments) {
      this.attachments.push(new Attachment(this, attachment, objectId++));
    }

    // Particle emitters
    for (let particleEmitter of parser.particleEmitters) {
      this.particleEmitters.push(new ParticleEmitterObject(this, particleEmitter, objectId++));
    }

    // Particle emitters 2
    for (let particleEmitter2 of parser.particleEmitters2) {
      this.particleEmitters2.push(new ParticleEmitter2Object(this, particleEmitter2, objectId++));
    }

    // Ribbon emitters
    for (let ribbonEmitter of parser.ribbonEmitters) {
      this.ribbonEmitters.push(new RibbonEmitterObject(this, ribbonEmitter, objectId++));
    }

    // Cameras
    for (let camera of parser.cameras) {
      this.cameras.push(new Camera(this, camera, objectId++));
    }

    // Event objects
    for (let eventObject of parser.eventObjects) {
      this.eventObjects.push(new EventObjectEmitterObject(this, eventObject, objectId++));
    }

    // Collision shapes
    for (let collisionShape of parser.collisionShapes) {
      this.collisionShapes.push(new CollisionShape(this, collisionShape, objectId++));
    }

    // One array for all generic objects.
    this.genericObjects.push(...this.bones, ...this.lights, ...this.helpers, ...this.attachments, ...this.particleEmitters, ...this.particleEmitters2, ...this.ribbonEmitters, ...this.cameras, ...this.eventObjects, ...this.collisionShapes);

    setupGroups(this);

    // Creates the sorted indices array of the generic objects.
    this.setupHierarchy(-1);

    // Keep a sorted array.
    for (let i = 0, l = this.genericObjects.length; i < l; i++) {
      this.sortedGenericObjects[i] = this.genericObjects[this.hierarchy[i]];
    }

    let variants = {
      nodes: [],
      geosets: [],
      layers: [],
      batches: [],
      any: [],
    };

    for (let i = 0, l = this.sequences.length; i < l; i++) {
      for (let object of this.genericObjects) {
        variants.nodes[i] = variants.nodes[i] || object.variants.generic[i];
      }

      for (let geoset of this.geosets) {
        variants.geosets[i] = variants.geosets[i] || geoset.variants.object[i];
      }

      for (let layer of this.layers) {
        variants.layers[i] = variants.layers[i] || layer.variants.object[i];
      }

      variants.batches[i] = variants.geosets[i] || variants.layers[i];
      variants.any[i] = variants.nodes[i] || variants.batches[i];
    }

    this.variants = variants;
  }

  /**
   *
   */
  loadTeamTextures() {
    let handler = this.handler;

    if (!handler.teamColors.length) {
      let teamColors = handler.teamColors;
      let teamGlows = handler.teamGlows;
      let viewer = this.viewer;
      let pathSolver = this.pathSolver;
      let ext = 'blp';

      if (this.version > 800) {
        ext = 'dds';
      }

      for (let i = 0; i < 14; i++) {
        let id = ('' + i).padStart(2, '0');

        teamColors[i] = viewer.load(`ReplaceableTextures\\TeamColor\\TeamColor${id}.${ext}`, pathSolver);
        teamGlows[i] = viewer.load(`ReplaceableTextures\\TeamGlow\\TeamGlow${id}.${ext}`, pathSolver);
      }
    }
  }

  /**
   * @param {number} parent
   */
  setupHierarchy(parent) {
    for (let i = 0, l = this.genericObjects.length; i < l; i++) {
      let object = this.genericObjects[i];

      if (object.parentId === parent) {
        this.hierarchy.push(i);

        this.setupHierarchy(object.objectId);
      }
    }
  }
}
