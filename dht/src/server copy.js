import url from "url";
import http from "http";

import serve from "./utils/static.js";
import swarm from "./swarm.js";

const send = (res, id, message) =>
  res.write(`data: ${JSON.stringify({ id, message })}\n\n`);

const requestListener = (callback, req, res) => {
  const pathname = decodeURI(url.parse(req.url).pathname);
  console.log(pathname);
  if (pathname === "/peers") {
    res.writeHead(200, {
      connection: "keep-alive",
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "access-control-allow-origin": "*",
    });

    send(res, "log", "ready");
    setInterval(() => send(res, "log", "ping"), 60000);

    const cleanFn = callback(({ data, details }) =>
      send(
        res,
        "data",
        JSON.stringify({
          data: data.toString(),
          peer: details.peer,
        })
      )
    );

    req.on("close", cleanFn);
    req.on("end", cleanFn);
  } else if (pathname.startsWith("/files/")) {
    const [peer, folder] = pathname.split("/").slice(2);
    console.log(swarm.connections)
    console.log(peer, folder);
    res.end();
  } else {
    res.setHeader("access-control-allow-origin", "*");
    serve(res, "/");
  }
};

export default (callback) => {
  const server = http.createServer((...args) =>
    requestListener(callback, ...args)
  );
  server.listen(8080);
};
