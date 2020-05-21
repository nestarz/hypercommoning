import Peer from "./peer.js";
import { watchFilesListRequest, watchDownloadRequest } from "./watchers.js";

export default class Peers {
  constructor() {
    this.peers = {};
    this.callbacks = [];
  }

  add(socket, details, base = ".") {
    const peer = new Peer(socket, details, base);
    watchFilesListRequest(peer, base);
    watchDownloadRequest(peer, base);

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
