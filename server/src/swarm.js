import hyperswarm from "hyperswarm";
import lpstream from "length-prefixed-stream";
import crypto from "crypto";
import stream from "stream";
import path from "path";
import pumpify from "pumpify";
import { promises as fs, createReadStream } from "fs";

const l = async (localRoute, route) => {
  const fileInfo = async (name) => ({
    name: name || path.basename(localRoute),
    route: path.join(route, name),
    extension: path.extname(name || localRoute),
    fileSizeInBytes: (await fs.stat(path.join(localRoute, name))).size,
  });

  console.log(localRoute);
  return fs.lstat(localRoute).then(async (stat) =>
    stat.isFile()
      ? [await fileInfo("")]
      : await fs
          .readdir(localRoute, "utf8")
          .catch(() => [])
          .then((files) => Promise.all(files.map(fileInfo)))
  );
};

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
  static unzip(data) {
    const event = data.slice(0, AddEvent.allocSize).toString().trimEnd();
    const buffer = data.slice(AddEvent.allocSize);
    return { event, buffer };
  }
}

class Peer {
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
      const { event, buffer } = AddEvent.unzip(data);
      this.callbacks[event]?.forEach((callback) => callback(buffer));
    });

    this.watchFilesListRequest(base);
    this.watchDownloadRequest(base);
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

  watchFilesListRequest(base) {
    this.on("askfiles", async (data) => {
      const route = data.toString();
      const files = await l(path.join(base, route), route);
      this.emit("answerfiles", JSON.stringify(files));
    });
  }

  watchDownloadRequest(base) {
    this.on("askdownload", async (data) => {
      const route = path.join(base, data.toString());
      this.emit("answerdownload", createReadStream(route));
    });
  }
}

class PeersState {
  constructor() {
    this.peers = {};
    this.callbacks = [];
  }

  add(socket, details, base = ".") {
    const peer = new Peer(socket, details, base);
    if (peer.id) {
      this.peers[peer.id] = peer;
      this.update();
    }
  }

  remove(_, details) {
    const id = Peer.createId(details);
    if (id in this.peers) {
      this.peers[id].destroy();
      delete this.peers[id];
      this.update();
    }
  }

  update() {
    this.callbacks.forEach((calllback) => calllback({ peers: this.toList() }));
  }

  onUpdate(callback) {
    this.callbacks.push(callback);
  }

  ask(peerId, question, args) {
    return new Promise((resolve, reject) => {
      if (!(peerId in this.peers)) reject("peerId unknown");
      const peer = this.peers[peerId];
      peer.emit("ask" + question, args);
      peer.on("answer" + question, resolve);
    });
  }

  toList() {
    return Object.freeze([...Object.keys(this.peers)]);
  }
}

export const swarm = (base = ".") => {
  const swarm = hyperswarm();
  const topic = crypto
    .createHash("sha256")
    .update("my-hyperswarm-topic")
    .digest();

  swarm.join(topic, {
    lookup: true,
    announce: true,
  });

  const peers = new PeersState(base);
  swarm.on("connection", (socket, info) => peers.add(socket, info, base));
  swarm.on("disconnection", (socket, info) => peers.remove(socket, info));

  return {
    peers,
    clean: () => {
      swarm.leave(topic);
      swarm.destroy();
    },
  };
};
