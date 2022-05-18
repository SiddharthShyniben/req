import color from "planckcolors";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";

export default function init() {
  console.log("Initializing req in current directory...");

  const dir = process.cwd();
  const files = readdirSync(dir, { withFileTypes: true });

  if (files.find((file) => file.name === ".reqrc")) {
    console.log(color.red("Found existing .reqrc file in current directory."));
    console.log(
      color.red("Looks like you already initialized req in this directory.")
    );
    console.log(color.red("Aborting."));
    process.exit(1);
  }

  try {
    mkdirSync(".req");
  } catch (e) {
    if (e.code !== "EEXIST") {
      throw e;
    }

    console.log(
      color.red("Found existing .req directory in current directory.")
    );
    console.log(
      color.red("Looks like you already initialized req in this directory.")
    );
    console.log(color.red("Aborting."));
    process.exit(1);
  }

  writeFileSync(
    ".reqrc",
    `
# Your req config goes here, as ini
`.trim()
  );

  writeFileSync(
    ".req/sample.http",
    `
# Sample req file
POST https://reqres.in/api/users HTTP/1.1
Content-Type: application/json

{
	"name": "morpheus",
	"job": "mentor",
	"location": "zion",
	"salary": "freedom"
}
`.trim()
  );

  console.log("Done. Edit .reqrc to configure req.");
}
