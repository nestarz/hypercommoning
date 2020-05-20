import url from "url";
import http from "http";
import net from "net";

const eventStream = (peers, send) => {
  send("log", "connected");
  send("peers", peers.toList());
  peers.onUpdate(({ peer }) => send("peer", peer));
  peers.onUpdate(({ peers }) => send("peers", peers));
};

const makeListener = (peers) => async (req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  const pathname = decodeURI(url.parse(req.url).pathname);
  if (pathname.startsWith("/peers")) {
    const send = (res, id, message) =>
      res.write(`data: ${JSON.stringify({ id, message })}\n\n`);

    res.writeHead(200, {
      connection: "keep-alive",
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "access-control-allow-origin": "*",
    });
    eventStream(peers, (...args) => send(res, ...args));
  } else if (pathname.startsWith("/check/")) {
    const [_, peer] = /^\/.[^\/]*\/(.[^\/]*)(.*)/g.exec(pathname);
    res.write(JSON.stringify({ exists: peers.toList().includes(peer) }));
    res.end();
  } else if (pathname.startsWith("/files/")) {
    const [_, peer, folder] = /^\/.[^\/]*\/(.[^\/]*)(.*)/g.exec(pathname);
    peers
      .ask(peer, "files", folder)
      .then((files) => res.write(JSON.stringify(files)))
      .catch((err) => res.writeHead(404, err))
      .finally(() => res.end());
  } else if (pathname.startsWith("/download/")) {
    const [_, peer, file] = /^\/.[^\/]*\/(.[^\/]*)(.*)/g.exec(pathname);
    peers
      .ask(peer, "download", file)
      .then((fileStream) => res.pipe(fileStream))
      .catch((err) => res.writeHead(404, err))
      .finally(() => res.end());
  } else {
    res.write(JSON.stringify(peers, null, 2));
    res.end();
  }
};

const isPortTaken = (port) =>
  new Promise((resolve, reject) => {
    const tester = net
      .createServer()
      .once("error", (err) => reject(err))
      .once("listening", () =>
        tester.once("close", () => resolve(port)).close()
      )
      .listen(port);
  });

const randomPort = () => Math.floor(5001 + Math.random() * 10000);

export default (swarm) =>
  isPortTaken(8080)
    .catch(randomPort)
    .then((port) => {
      const listener = makeListener(swarm.peers);
      const server = http.createServer(listener);
      server.listen(port);

      const protocol = "http";
      return { url: `${protocol}://localhost:${port}`, protocol, port };
    });
