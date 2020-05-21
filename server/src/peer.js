import lpstream from "length-prefixed-stream";
import stream from "stream";
import pumpify from "pumpify";

class AddEvent extends stream.Transform {
  static allocSize = 40;
  constructor(event) {
    super();
    this.event = event.padEnd(AddEvent.allocSize, " ");
  }
  _transform(chunk, _, done) {
    this.push(Buffer.concat([Buffer.from(this.event), chunk]));
    done();
  }
  static unwrap(data) {
    const event = data.slice(0, AddEvent.allocSize).toString().trimEnd();
    const buffer = data.slice(AddEvent.allocSize);
    return { event, buffer };
  }
}

export default class Peer {
  static createId = (details) =>
    details.peer ? `${details.peer.host}:${details.peer.port}` : null;

  constructor(socket, details, base) {
    this.id = Peer.createId(details);
    this.socket = socket;
    this.callbacks = {};

    this.encoder = lpstream.encode();
    this.decoder = lpstream.decode();

    this.send = pumpify(this.encoder, this.socket).on("error", this.destroy);
    this.receive = pumpify(this.socket, this.decoder).on("error", this.destroy);

    this.receive.on("data", (data) => {
      const { event, buffer } = AddEvent.unwrap(data);
      this.callbacks[event]?.forEach((callback) => callback(buffer));
    });
  }

  toStream = (message) => {
    const messageStream = new stream.Readable();
    messageStream.push(message);
    messageStream.push(null);
    return messageStream;
  };

  emit(event, message) {
    const messageStream =
      message instanceof stream.Stream ? message : this.toStream(message);
    messageStream.pipe(new AddEvent(event)).pipe(this.send, { end: false });
  }

  on(event, callback) {
    this.callbacks[event] = this.callbacks[event] ?? [];
    this.callbacks[event].push(callback);
  }

  destroy(err) {
    err && console.log(err);
    this.send && this.send.destroy();
    this.receive && this.receive.destroy();
    this.callbacks = {};
  }
}
