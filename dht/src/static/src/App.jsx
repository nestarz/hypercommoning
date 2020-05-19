import React, { useEffect, useState } from "react";
import { Router, Link } from "@reach/router";
import register from "./event-source.js";

const base = "http://localhost:8080";

const join = (...args) =>
  args
    .join("/")
    .replace(/[\/]+/g, "/")
    .replace(/^(.+):\//, "$1://")
    .replace(/^file:/, "file:/")
    .replace(/\/(\?|&|#[^!])/g, "$1")
    .replace(/\?/g, "&")
    .replace("&", "?");

const usePeers = () => {
  const [peers, setPeers] = useState([]);
  useEffect(() => {
    register(new EventSource(new URL("peers", base)), {
      peers: (peers) => setPeers(peers),
      peer: (peer) => setPeers([...peers, peer]),
      log: console.log,
    });
  }, []);
  return peers;
};

const useFiles = (host, dir) => {
  const [files, setFiles] = useState([]);
  useEffect(() => {
    fetch(join(base, "files", host, dir))
      .then((r) => r.json())
      .then(setFiles);
  }, [host, dir]);
  return files;
};

const Files = ({ host, dir }) => {
  console.log(dir);
  const files = useFiles(host, dir);
  const base = join("/", "remote", host);
  return (
    <>
      {files.map((name) => (
        <li>
          <Link to={dir ? join(base, dir, name) : join(base, name)}>
            {name}
          </Link>
        </li>
      ))}
    </>
  );
};

const Peer = ({ host, dir = "/" }) => (
  <div>
    {host}
    <Files host={host} dir={dir}></Files>
  </div>
);

const Peers = () => {
  const peers = usePeers();
  console.log(peers);
  return (
    <>
      Peers
      {peers.map((host) => (
        <Peer host={host}></Peer>
      ))}
    </>
  );
};

const Discover = () => <Peers></Peers>;
const Browse = ({ host, location: { pathname } }) => (
  <Peer host={host} dir={/^\/.[^\/]*\/(.[^\/]*)(.*)/.exec(pathname)[2]}></Peer>
);

export default () => (
  <Router>
    <Discover path="/" />
    <Browse path="/remote/:host/:dir/*" />
  </Router>
);
