import hyperswarm from "hyperswarm";
import crypto from "crypto";

import Peers from "./peers.js";

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

  const peers = new Peers(base);
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
