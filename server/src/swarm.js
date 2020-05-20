import hyperswarm from "hyperswarm";
import crypto from "crypto";
import stream from "stream";
import path from "path";
import { promises as fs, createWriteStream } from "fs";

const l = async (route) =>
  fs
    .readdir(route, "utf8")
    .catch(() => [])
    .then((files) =>
      Promise.all(
        files.map(async (name) => ({
          name,
          route: path.join(route, name),
          extension: path.extname(name),
          fileSizeInBytes: (await fs.stat(path.join(route, name))).size,
        }))
      )
    );

class Peer {
  constructor(socket, details, base) {
    this.id = details.peer ? `${details.peer.host}:${details.peer.port}` : null;
    this.socket = socket;
    this.callbacks = [];
    this.socket.on("data", (data) => {
      const { message, event: incEvent } = JSON.parse(data.toString());
      this.callbacks
        .filter(({ event }) => event === incEvent)
        .forEach(({ callback }) => callback(message));
    });

    this.watchFilesListRequest(base);
    this.watchDownloadRequest(base);
  }

  on(event, callback) {
    this.callbacks.push({ event, callback });
  }

  emit(event, message) {
    this.bufferStream = new stream.PassThrough();
    this.bufferStream.pipe(this.socket);
    this.bufferStream.write(JSON.stringify({ event, message }));
  }

  watchFilesListRequest(base) {
    this.on("files", async (data) => {
      if (Array.isArray(data)) return;
      const files = await l(path.join(base, data));
      this.emit("files", files);
    });
  }

  watchDownloadRequest(base) {
    this.on("download", async (data) => {
      console.log(path.join(base, data));
      console.log(createWriteStream(path.join(base, data)));
      createWriteStream(path.join(base, data)).pipe(this.socket);
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
      this.callbacks.forEach((calllback) =>
        calllback({ peer, peers: Object.freeze(this.peers) })
      );
    }
  }

  onUpdate(callback) {
    this.callbacks.push(callback);
  }

  ask(peerId, question, args) {
    return new Promise((resolve, reject) => {
      if (!(peerId in this.peers)) reject("peerId unknown");
      const peer = this.peers[peerId];
      peer.emit(question, args);
      peer.on(question, resolve);
    });
  }

  toList() {
    return Object.freeze(Object.keys(this.peers));
  }
}

export const swarm = (stdout = () => null, base = ".") => {
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

  return {
    peers,
    clean: () => {
      swarm.leave(topic);
      swarm.destroy();
    },
  };
};
