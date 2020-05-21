#!/usr/bin/env node

import { swarm } from "./src/swarm.js";
import serve from "./src/server.js";

function cli(command, ...args) {
  const actions = {
    [undefined]: () => serve(),
    swarm: () => swarm(args[0]),
    serve: () => serve(swarm(args[0])).then(console.log),
  };

  if (command in actions) actions[command]();
  else console.error("Error in command. Supported: ", Object.keys(actions));
}

console.log(`HyperCommons`);
cli(...process.argv.slice(2));
