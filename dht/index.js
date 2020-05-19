#!/usr/bin/env node

import { swarm } from "./src/swarm.js";
import serve from "./src/server.js";

function cli(command, ...args) {
  const actions = {
    [undefined]: () => serve(),
    swarm: () => swarm(({ data }) => console.log(data), args[0]),
    serve: () => serve(swarm()),
  };

  if (command in actions) actions[command]();
  else console.error("Error in command. Supported: ", Object.keys(actions));
}

console.log(`HyperCommons`);
cli(...process.argv.slice(2));
