import fs from "fs";
import path from "path";
import zlib from "zlib";

import mimeTypes from "./mime.js";

const isRouteRequest = (pathname) => !~pathname.split("/").pop().indexOf(".");
const utf8 = (file) => Buffer.from(file, "binary").toString("utf8");

const sendError = (res, status) => {
  res.writeHead(status);
  res.write(`${status}`);
  res.end();
};

const sendFile = (res, status, file, ext, encoding = "binary") => {
  if (["js", "css", "html", "json", "xml", "svg"].includes(ext)) {
    res.setHeader("content-encoding", "gzip");
    file = zlib.gzipSync(utf8(file));
    encoding = "utf8";
  }
  res.writeHead(status, {
    "content-type":
      ext === "html" ? "text/html; charset=utf-8" : mimeTypes(ext),
  });
  res.write(file, encoding);
  res.end();
};

export default (res, pathname) => {
  const uri = path.join(
    "./src/static/",
    isRouteRequest(pathname) ? "index.html" : pathname
  );
  const ext = uri.replace(/^.*[\.\/\\]/, "").toLowerCase();
  if (!fs.existsSync(uri)) return sendError(res, 404);
  fs.readFile(uri, "binary", (err, file) =>
    err ? sendError(res, 500) : sendFile(res, 200, file, ext)
  );
};
