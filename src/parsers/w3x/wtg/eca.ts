import BinaryStream from '../../../common/binarystream';
import { byteLengthUtf8 } from '../../../common/utf8';
import Parameter from './parameter';
import { FunctionSignature, TriggerData } from './triggerdata';

/**
 * An Event/Condition/Action.
 */
export default class ECA {
  type: number = -1;
  group: number = -1;
  name: string = '';
  isEnabled: number = 0;
  parameters: Parameter[] = [];
  ecas: ECA[] = [];

  load(stream: BinaryStream, version: number, isChildECA: boolean, triggerData: TriggerData) {
    this.type = stream.readInt32();

    if (this.type < 0 || this.type > 3) {
      throw new Error(`ECA: Bad type: ${this.type}`);
    }

    if (isChildECA) {
      this.group = stream.readUint32();
    }

    this.name = stream.readNull();

    if (this.name.length === 0) {
      throw new Error('ECA: Empty name');
    }

    this.isEnabled = stream.readInt32();

    let signature = triggerData.getFunction(this.type, this.name);

    if (!signature) {
      throw new Error(`ECA "${this.name}:${this.type}": Unknown signature`);
    }

    let args = signature.args;

    for (let i = 0, l = args.length; i < l; i++) {
      let parameter = new Parameter();

      try {
        parameter.load(stream, version, triggerData);
      } catch (e) {
        throw new Error(`ECA "${this.name}": Parameter ${i}: ${e}`);
      }

      this.parameters[i] = parameter;
    }

    if (version === 7) {
      for (let i = 0, l = stream.readUint32(); i < l; i++) {
        let eca = new ECA();

        try {
          eca.load(stream, version, true, triggerData);
        } catch (e) {
          throw new Error(`ECA "${this.name}": Child ECA ${i} ${e}`);
        }

        this.ecas[i] = eca;
      }
    }
  }

  save(stream: BinaryStream, version: number) {
    stream.writeInt32(this.type);

    if (this.group !== -1) {
      stream.writeInt32(this.group);
    }

    stream.writeNull(this.name);
    stream.writeInt32(this.isEnabled);

    for (let parameter of this.parameters) {
      parameter.save(stream, version);
    }

    if (version === 7) {
      stream.writeUint32(this.ecas.length);

      for (let eca of this.ecas) {
        eca.save(stream, version);
      }
    }
  }

  getByteLength(version: number) {
    let size = 9 + byteLengthUtf8(this.name);

    if (this.group !== -1) {
      size += 4;
    }

    for (let parameter of this.parameters) {
      size += parameter.getByteLength(version);
    }

    if (version === 7) {
      size += 4;

      for (let eca of this.ecas) {
        size += eca.getByteLength(version);
      }
    }

    return size;
  }
}
