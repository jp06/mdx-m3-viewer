/**
 * @constructor
 */
function MdxShallowAttachment(instance, attachment) {
    let internalInstance = attachment.internalModel.addInstance();

    instance.scene.addInstance(internalInstance);

    internalInstance.setSequenceLoopMode(2);
    internalInstance.dontInheritScale = false;
    internalInstance.rendered = false;

    instance.whenLoaded(() => internalInstance.setParent(instance.skeleton.nodes[attachment.node.objectId]));

    this.instance = instance;
    this.attachment = attachment;
    this.internalInstance = internalInstance;
}

MdxShallowAttachment.prototype = {
    update() {
        let internalInstance = this.internalInstance;

        if (this.attachment.getVisibility(this.instance) > 0.1) {
            if (!internalInstance.rendered) {
                internalInstance.rendered = true;

                // Every time the attachment becomes visible again, restart its first sequence.
                internalInstance.setSequence(0);
            }
        } else {
            internalInstance.rendered = false;
        }
    }
};

/**
 * @constructor
 */
function MdxAttachment(model, attachment) {
    let path = attachment.path.replace(/\\/g, "/").toLowerCase().replace(".mdl", ".mdx");

    this.node = attachment.node;
    this.path = path;
    this.attachmentId = attachment.attachmentId;
    this.sd = new MdxSdContainer(attachment.tracks, model);

    // Second condition is against custom resources using arbitrary paths...
    if (path !== "" && path.indexOf(".mdx") != -1) {
        this.internalModel = model.env.load(path, model.pathSolver);
    }
}

MdxAttachment.prototype = {
    getVisibility(instance) {
        return this.sd.getValue("KATV", instance, 1);
    }
};
