import React, {useCallback, useEffect, useState} from "react";
import {Router, Link} from "@reach/router";
import register from "./../../src/event-source.js";
const base = "http://localhost:8080";
const join = (...args) => args.join("/").replace(/[\/]+/g, "/").replace(/^(.+):\//, "$1://").replace(/^file:/, "file:/").replace(/\/(\?|&|#[^!])/g, "$1").replace(/\?/g, "&").replace("&", "?");
const usePeers = () => {
  const [peers, setPeers] = useState([]);
  useEffect(() => {
    register(new EventSource(new URL("peers", base)), {
      peers: (peers2) => setPeers(peers2),
      peer: (peer) => setPeers([...peers, peer]),
      log: console.log
    });
  }, []);
  return peers;
};
const useFiles = (host, dir) => {
  const [files, setFiles] = useState([]);
  useEffect(() => {
    fetch(join(base, "files", host, dir)).then((r) => r.json()).then(setFiles);
  }, [host, dir]);
  return files;
};
const Download = ({name, host, route, children}) => {
  const download = useCallback(() => {
    fetch(join(base, "download", host, route)).then((res) => console.log(res) || res.blob()).then((blob) => {
      const file = window.URL.createObjectURL(blob);
      window.location.assign(file);
    });
  }, [host, route]);
  return React.createElement("a", {
    href: "#",
    onClick: download
  }, children);
};
const Files = ({host, dir}) => {
  const files = useFiles(host, dir);
  const base2 = join("/", "remote", host);
  return React.createElement(React.Fragment, null, files.map(({name, route, extension}) => React.createElement("li", null, extension ? React.createElement(Download, {
    host,
    route,
    name
  }, name) : React.createElement(Link, {
    to: dir ? join(base2, dir, name) : join(base2, name)
  }, name))));
};
const Peer = ({host, dir = "/"}) => React.createElement("div", null, host, React.createElement(Files, {
  host,
  dir
}));
const Peers = () => {
  const peers = usePeers();
  console.log(peers);
  return React.createElement(React.Fragment, null, "Peers", peers.map((host) => React.createElement(Peer, {
    host
  })));
};
const useVerifyPeer = (host) => {
  const [exists, setExists] = useState();
  const [loading, setLoading] = useState();
  useEffect(() => {
    setLoading(true);
    fetch(join(base, "check", host)).then((r) => r.json()).then(({exists: exists2}) => setExists(exists2)).finally(() => setLoading(false));
  }, [host]);
  return {
    exists,
    loading
  };
};
const VerifyPeer = ({host, children}) => {
  const {exists, loading} = useVerifyPeer(host);
  return loading ? React.createElement(React.Fragment, null, "Fetching...") : !exists ? React.createElement(React.Fragment, null, "Peer not found...") : children;
};
const Discover = () => React.createElement(Peers, null);
const Browse = ({host, location: {pathname}}) => React.createElement(VerifyPeer, {
  host
}, React.createElement(Peer, {
  host,
  dir: /^\/.[^\/]*\/(.[^\/]*)(.*)/.exec(pathname)[2]
}));
export default () => React.createElement(Router, null, React.createElement(Discover, {
  path: "/"
}), React.createElement(Browse, {
  path: "/remote/:host/:dir/*"
}));
