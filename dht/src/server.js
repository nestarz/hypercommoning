import url from "url";
import http from "http";
import net from "net";

const streamUpdate = (swarm, res, req) => {
  const send = (id, message) =>
    res.write(`data: ${JSON.stringify({ id, message })}\n\n`);

  res.writeHead(200, {
    connection: "keep-alive",
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    "access-control-allow-origin": "*",
  });

  send("log", "connected");
  send("peers", Object.keys(swarm.peers));
  swarm.swarm.on(
    "connection",
    (_, details) => details.peer && send("peer", details.peer.host)
  );
  //req.on("close", cleanFn);
  //req.on("end", cleanFn);
};

const makeListener = (swarm) => async (req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  const pathname = decodeURI(url.parse(req.url).pathname);
  if (pathname.startsWith("/peers")) streamUpdate(swarm, res, req);
  else if (pathname.startsWith("/files/")) {
    const [_, peer, folder] = /^\/.[^\/]*\/(.[^\/]*)(.*)/g.exec(pathname);
    console.log(peer, Object.keys(swarm.peers));
    console.log("asking files", [peer], folder);
    const files = await swarm.peers[peer].askFiles(folder);
    console.log("files", files);
    res.write(JSON.stringify(files));
    res.end();
  }
};

const isPortTaken = (port) =>
  new Promise((resolve, reject) => {
    const tester = net
      .createServer()
      .once("error", (err) =>
        err.code == "EADDRINUSE" ? resolve(false) : reject(err)
      )
      .once("listening", () =>
        tester.once("close", () => resolve(true)).close()
      )
      .listen(port);
  });

export default async (swarm) => {
  const listener = makeListener(swarm);
  const server = http.createServer(listener);
  server.listen(
    (await isPortTaken(8080)) ? 8080 : Math.floor(5001 + Math.random() * 10000)
  );
};
