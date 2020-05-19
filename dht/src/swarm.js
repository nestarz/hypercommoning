import hyperswarm from "hyperswarm";
import crypto from "crypto";
import stream from "stream";
import path from "path";
import { promises as fs } from "fs";

const ls = async (folder) => fs.readdir(folder).catch(() => []);

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

  const peers = {};
  swarm.on("connection", (socket, details) => {
    if (!details.peer) return;

    const bufferStream = new stream.PassThrough();
    bufferStream.pipe(socket);

    const peer = peers[details.peer.host] || details.peer;
    console.log(details.peer.host);
    peers[details.peer.host] = {
      ...peer,
      socket,
      askFiles: async (folder) => {
        bufferStream.write(JSON.stringify({ id: "folder", folder }));
        bufferStream.end();
        return await new Promise((resolve) => {
          socket.on("data", (data) => resolve(JSON.parse(data.toString())));
        });
      },
    };
  });

  swarm.on("connection", async (socket, details) => {
    const bufferStream = new stream.PassThrough();
    bufferStream.pipe(socket);

    socket.on("data", async (data) => {
      const { id, folder } = JSON.parse(data.toString());
      if (id === "folder") {
        const folders = await ls(path.join(base, folder));
        bufferStream.write(JSON.stringify(folders));
        bufferStream.end();
        stdout({ data: data.toString(), socket, details });
      }
    });
  });

  return {
    swarm,
    peers,
    clean: () => {
      swarm.leave(topic);
      swarm.destroy();
    },
  };
};
