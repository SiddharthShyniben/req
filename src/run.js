import color from "planckcolors";
import fetch from "node-fetch";
import fuzzysort from "fuzzysort";
import { NodeVM } from "vm2";

import { inspect } from "util";
import { join, resolve } from "path";
import { existsSync, readdirSync, readFileSync } from "fs";

import { parse } from "./parse.js";
import { getVariables } from "./config.js";
import { isInitialized, STATUSES } from "./util.js";

const cwd = process.cwd();

export default function run(args) {
  if (!isInitialized()) {
    console.error(
      color.red("req has not been initialized.\nRun `req init` to initialize.")
    );
    process.exit(1);
  }

  const file = args._[1];

  if (!file) {
    console.error(color.red("No file specified!"));
    process.exit(1);
  }

  let path = resolve(cwd, ".req", `${file}.http`);
  let content;

  if (existsSync(path)) {
    content = readFileSync(path, "utf8");
    return runHttp(content, args);
  }

  path = resolve(cwd, ".req", `${file}.flow.js`);

  if (existsSync(path)) {
    content = readFileSync(path, "utf8");

    try {
      runFlow(content, Object.assign({}, getVariables(), args.flags));
    } catch (e) {
      console.error(color.red("Flow error: "));
      console.error(e);
      process.exit(1);
    }

    return;
  }

  console.error(color.red(`Request ${file} not found!`));

  const allTheFiles = readdirSync(join(cwd, ".req")).map(
    (k) => k.split(".")[0]
  );
  const similar = fuzzysort.go(file, allTheFiles);
  const hl = similar.map(
    (k) => "\t" + fuzzysort.highlight(k, "\x1b[31m", "\x1B[0m")
  );

  console.log();
  if (similar.length > 0) {
    console.log("Did you mean:");
    console.log(hl.join("\n"));
  } else {
    console.log("Available requests:");
    console.log(allTheFiles.map((k) => "\t" + k).join("\n"));
  }

  process.exit(1);
}

function prep(content, args) {
  const parsed = parse(content);
  const { method, headers } = parsed;
  let { body, url } = parsed;

  if (method === "GET" || method === "HEAD") {
    if (body) {
      body = undefined;
      console.error(color.cyan(`Note: body ignored for ${method} request`));
    }
  }

  let showFullResponse;
  let showFullHeaders;
  let plainJSON;

  if (args.flags.full) {
    showFullResponse = true;
    showFullHeaders = true;
    delete args.flags.full;
  }

  if ("all-headers" in args.flags) {
    showFullHeaders = args.flags["all-headers"];
    delete args.flags["all-headers"];
  }

  if ("full-response" in args.flags) {
    showFullResponse = args.flags["full-response"];
    delete args.flags["full-response"];
  }

  if ("json" in args.flags) {
    plainJSON = args.flags.json;
    delete args.flags.json;
  }

  const variables = Object.assign(getVariables(), args.flags);

  const addVariables = (x) =>
    x.replace(
      /{(\w+)[ \t]*(?:\|[ \t]*(.+))?}/g,
      (_, key, def) => variables[key] ?? def ?? ""
    );

  url = url.replace(/{(\w+)[ \t]*(?:\|[ \t]*(.+))?}/g, (_, key, def) =>
    encodeURIComponent(variables[key] ?? def ?? "")
  );

  Object.keys(headers).forEach(
    (key) => (headers[key] = addVariables(headers[key]))
  );
  if (typeof body === "object")
    Object.keys(body).forEach((key) => (body[key] = addVariables(body[key])));
  if (typeof body === "string") body = addVariables(body);

  return {
    method,
    headers,
    body,
    url,
    showFullResponse,
    showFullHeaders,
    plainJSON,
  };
}

function runHttp(content, args) {
  const {
    method,
    headers,
    body,
    url,
    showFullResponse,
    showFullHeaders,
    plainJSON,
  } = prep(content, args);

  fetch(url, { method, headers, body })
    .then(async (res) => {
      let body;

      try {
        body = await res.clone().json();
      } catch {
        body = await res.text();
      }

      return {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body,
      };
    })
    .then((res) => {
      if (plainJSON) {
        console.log(JSON.stringify(res));
        return;
      }

      console.log(colorMethod(method), color.bold(url));

      console.log(
        color.bold("  Status:"),
        colorStatus(`${res.status} ${STATUSES[res.status] ?? "UNKNOWN"}`)
      );

      const hidden = Object.fromEntries(
        Object.entries(res.headers).filter(commonHiddenFilters(showFullHeaders))
      );
      const hiddenLength =
        Object.keys(res.headers).length - Object.keys(hidden).length;

      console.log(
        color.bold("  Headers"),
        color.dim(`(${hiddenLength} hidden)`) + color.bold(":")
      );

      Object.entries(hidden).forEach(([key, value]) =>
        console.log(`    ${key}: ${value}`)
      );

      let type = res.headers["content-type"];
      if (type) type = type.split(";")[0].trim();
      console.log(
        color.bold("  Body") +
          color.dim(type ? ` (${type})` : "") +
          color.bold(":")
      );

      const inspected = inspect(res.body, {
        depth: null,
        colors: true,
        maxStringLength: showFullResponse ? Infinity : 1000,
        maxArrayLength: showFullResponse ? Infinity : 100,
      });
      const sliceLength =
        process.stdout.rows - (10 + Object.keys(hidden).length);

      console.log(
        inspected
          .split("\n")
          .slice(0, showFullResponse ? Infinity : sliceLength)
          .map((line) => "    " + line)
          .join("\n")
      );

      if (inspected.split("\n").length > sliceLength && !showFullResponse) {
        console.log(
          color.dim(
            `    ...${
              inspected.split("\n").length - sliceLength
            } more lines (use`
          ),
          color.yellow("--full-response"),
          color.dim("to see the whole response)")
        );
      }
    })
    .catch((e) => {
      console.error(color.red("Failed to send request!"));

      if (e.message.toLowerCase().includes("invalid url"))
        console.error("You passed an invalid URL!");
      else console.error(e.name + ": " + e.message);

      process.exit(1);
    });
}

function commonHiddenFilters(show) {
  return show
    ? () => true
    : ([k]) => {
        const hidden = [
          "nel",
          "server",
          "via",
          "x-powered-by",
          "alt-svc",
          "connection",
          "content-length",
          "etag",
          "report-to",
          "expect-ct",
          "content-type",
          "set-cookie",
          "expires",
          "p3p",
          "cache-control",
        ];

        k = k.toLowerCase();
        if (k.startsWith("access-control")) return false;
        if (k.startsWith("cf-")) return false;
        if (hidden.includes(k)) return false;

        return true;
      };
}

function colorStatus(status) {
  if (status === "418 I'M A TEAPOT") return randomColor(status);
  return (
    {
      2: color.green(status),
      3: color.yellow(status),
      4: color.red(status),
      5: color.red(status),
    }[Math.floor(+status.split(" ")[0] / 100)] ?? status
  );
}

function colorMethod(method) {
  const c =
    {
      get: color.green,
      post: color.yellow,
      put: color.cyan,
      delete: color.red,
    }[method.toLowerCase()] ?? color.bold;
  return c(method);
}

function randomColor(str) {
  const colors = [
    color.magenta,
    color.blue,
    color.green,
    color.yellow,
    color.red,
    color.yellow,
    color.green,
    color.blue,
  ];

  return str
    .split("")
    .map((c, i) => colors[i % colors.length](c))
    .join("");
}

function runFlow(source, v) {
  let ret = null;
  const vm = new NodeVM({
    sandbox: {
      variables: v,
      run(request, variables) {
        let path = resolve(cwd, ".req", `${request}.http`);

        if (!existsSync(path)) {
          path = resolve(cwd, ".req", `${request}.flow.js`);

          if (!existsSync(path)) {
            throw new Error(`Could not find request ${request}`);
          }

          const contents = readFileSync(path, "utf8");
          return runFlow(contents, Object.assign({}, v ?? {}, variables ?? {}));
        }

        const contents = readFileSync(path, "utf8");

        let method, headers, body, url;
        try {
          ({ method, headers, body, url } = prep(contents, {
            flags: Object.assign({}, v ?? {}, variables),
          }));
        } catch (e) {
          console.error(color.red(`Error executing flow: ${e.message}`));
        }

        return fetch(url, { method, headers, body }).then(async (res) => {
          let body;

          try {
            body = await res.clone().json();
          } catch (e) {
            body = await res.text();
          }

          return {
            status: res.status,
            headers: Object.fromEntries(res.headers.entries()),
            body,
          };
        });
      },
      finish(k) {
        ret = k;
      },
    },
    allowAsync: true,
  });

  vm.run(source);
  return ret;
}
