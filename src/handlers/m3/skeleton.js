function ShallowBone (bone) {
  this.boneImpl = bone;
  this.parent = bone.parent;
  this.worldMatrix = mat4.create();
  this.scale = vec3.create();
  this.inverseScale = vec3.create();
  this.externalWorldMatrix = mat4.create();
}

ShallowBone.prototype = {
  getTransformation: function () {
    var m = this.externalWorldMatrix;
    
    mat4.copy(m, this.worldMatrix);
    // Remove the local rotation as far as external objects know
    mat4.rotateZ(m, m, -Math.PI / 2);
    
    return m;
  }
};

function Skeleton(model, ctx) {
  var i, l;
  var bones = model.bones;
  var boneLookup = model.boneLookup;
  
  this.initialReference = model.initialReference;
  this.sts = model.sts;
  this.stc = model.stc;
  this.stg = model.stg;
  this.bones = [];
  
  this.boneLookup = boneLookup;
  this.hwbones = new Float32Array(16 * boneLookup.length);
  this.boneTexture = ctx.createTexture();
  this.boneTextureSize = Math.max(2, Math.powerOfTwo(boneLookup.length + 1)) * 4;
  this.texelFraction = 1 / this.boneTextureSize;
  this.matrixFraction = this.texelFraction * 4;
  
  ctx.activeTexture(ctx.TEXTURE15);
  ctx.bindTexture(ctx.TEXTURE_2D, this.boneTexture);
  ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, this.boneTextureSize, 1, 0, ctx.RGBA, ctx.FLOAT, null);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST);
  
  for (i = 0, l = bones.length; i < l; i++) {
    this.bones[i] = new ShallowBone(bones[i]);
  }
  
  this.localMatrix = mat4.create();
  this.rotationMatrix = mat4.create();
  
  this.locationVec = vec3.create();
  this.scaleVec = vec3.create();
  this.rotationQuat = quat.create();
  
  this.rootScaler = vec3.fromValues(100, 100, 100);
}

Skeleton.prototype = {
  // NOTE: This function assumes that the bones are sorted in such way that a child would always be after its parent. Is this true?
  update: function (sequence, frame, worldMatrix, ctx) {
    var root = this.bones[0];
    
    mat4.copy(root.worldMatrix, worldMatrix);
    
    // Transform the skeleton to approximately match the size of Warcraft 3 models, and to have the same rotation
    mat4.scale(root.worldMatrix, root.worldMatrix, this.rootScaler);
    mat4.rotateZ(root.worldMatrix, root.worldMatrix, Math.PI / 2);
    
    mat4.decomposeScale(root.scale, root.worldMatrix);
    vec3.inverse(root.inverseScale, root.scale);
    
    for (var i = 1, l = this.bones.length; i < l; i++) {
      this.updateBone(this.bones[i], sequence, frame);
    }
    
    this.updateBoneTexture(sequence, ctx);
  },
  
  getValue: function (out, animRef, sequence, frame) {
    if (sequence !== -1) {
      return this.stg[sequence].getValue(out, animRef, frame)
    }
    
    return animRef.initValue;
  },
  
  updateBone: function (bone, sequence, frame) {
    var localMatrix = this.localMatrix;
    var rotationMatrix = this.rotationMatrix;
    var location = this.getValue(this.locationVec, bone.boneImpl.location, sequence, frame);
    var rotation = this.getValue(this.rotationQuat, bone.boneImpl.rotation, sequence, frame);
    var scale = this.getValue(this.scaleVec, bone.boneImpl.scale, sequence, frame);
    
    mat4.fromRotationTranslationScale(localMatrix, rotation, location, scale);
    mat4.multiply(bone.worldMatrix, this.bones[bone.parent].worldMatrix, localMatrix);
    
    mat4.decomposeScale(bone.scale, bone.worldMatrix);
    vec3.inverse(bone.inverseScale, bone.scale);
  },
  
  updateBoneTexture: function (sequence, ctx) {
    var bones = this.bones;
    var hwbones = this.hwbones;
    var initialReferences = this.initialReference;
    var boneLookup = this.boneLookup;
    var bone;
    var finalMatrix;
    
    if (sequence === -1) {
      finalMatrix = this.bones[0].worldMatrix;
    } else {
      finalMatrix = this.localMatrix;
    }
    
    for (var i = 0, l = boneLookup.length; i < l; i++) {
      if (sequence !== -1) {
        bone = boneLookup[i];
        // 1 added to account for the injected root
        mat4.multiply(finalMatrix, bones[bone + 1].worldMatrix, initialReferences[bone]);
      } 
      
      hwbones.set(finalMatrix, i * 16);
    }
  
    ctx.activeTexture(ctx.TEXTURE15);
    ctx.bindTexture(ctx.TEXTURE_2D, this.boneTexture);
    ctx.texSubImage2D(ctx.TEXTURE_2D, 0, 0, 0, boneLookup.length * 4, 1, ctx.RGBA, ctx.FLOAT, hwbones);
  },
  
  bind: function (shader, ctx) {
    ctx.activeTexture(ctx.TEXTURE15);
    ctx.bindTexture(ctx.TEXTURE_2D, this.boneTexture);
    
    ctx.uniform1i(shader.variables.u_boneMap, 15);
    ctx.uniform1f(shader.variables.u_matrix_size, this.matrixFraction);
    ctx.uniform1f(shader.variables.u_texel_size, this.texelFraction);
  }
};