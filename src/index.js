#!/usr/bin/env node

import nanoparse from "nanoparse";
import unbug from "unbug";
import color from "planckcolors";

import "./warning.js";

import init from "./init.js";
import run from "./run.js";
import help from "./help.js";

const args = nanoparse(process.argv.slice(2));
const command = args._[0];

const debug = unbug("controller");

const commands = {
  default: () => {
    console.log(color.bold(color.red("Invalid command!")));
  },
  no_command: () => {
    console.log(color.red("No command detected!"));
    console.log(
      "Run",
      color.bold(color.green("req help")),
      "for more information."
    );
  },
  help,
  init,
  run,
  async version() {
    console.log(
      "req",
      "v" +
        (await import("../package.json", { assert: { type: "json" } })).default
          .version
    );
  },
};

commands.v = commands.version;

debug("Starting up...");
debug("Command:", command);
debug("Args:", args);

if (!command) {
  commands.no_command();
} else {
  const the_command = commands[command] || commands.default;
  the_command(args);
}
