import color from "planckcolors";
import fuzzysort from "fuzzysort";
import { NodeVM } from "vm2";

import { inspect } from "util";
import { join, resolve } from "path";
import { existsSync, readdirSync, readFileSync } from "fs";

import { parse } from "./parse.js";
import { getVariables } from "./config.js";
import {
  colorMethod,
  colorStatus,
  getRequestByName,
  indent,
  isInitialized,
  prepFetch,
  STATUSES,
} from "./util.js";

const cwd = process.cwd();

export default function run(args) {
  if (!isInitialized(cwd)) {
    console.error(
      color.red("req has not been initialized.\nRun `req init` to initialize."),
    );
    process.exit(1);
  }

  const file = args._[1];

  if (!file) {
    console.error(color.red("No file specified!"));
    process.exit(1);
  }

  const req = getRequestByName(file);
  if (!req) {
    console.error(color.red(`Request ${file} not found!`));

    const allTheFiles = readdirSync(join(cwd, ".req")).map(
      (k) => k.split(".")[0],
    );
    const similar = fuzzysort.go(file, allTheFiles);
    const hl = similar.map((k) =>
      indent(fuzzysort.highlight(k, "\x1b[31m", "\x1B[0m")),
    );

    console.log();
    if (similar.length > 0) {
      console.log("Did you mean:");
      console.log(hl.join("\n"));
    } else {
      console.log("Available requests:");
      console.log(allTheFiles.map(indent).join("\n"));
    }

    process.exit(1);
  }

  const { type, content } = req;

  if (type === "http") {
    return runHttp(content, args);
  }

  try {
    runFlow(content, Object.assign(getVariables(), args.flags));
  } catch (e) {
    console.error(color.red("Flow error: "));
    console.error(e);
    process.exit(1);
  }
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
      (_, key, def) => variables[key] ?? def ?? "",
    );

  url = url.replace(/{(\w+)[ \t]*(?:\|[ \t]*(.+))?}/g, (_, key, def) =>
    encodeURIComponent(variables[key] ?? def ?? ""),
  );

  Object.keys(headers).forEach((key) => {
    headers[key] = addVariables(headers[key]);
  });

  if (typeof body === "object")
    Object.keys(body).forEach((key) => {
      body[key] = addVariables(body[key]);
    });

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

  prepFetch({ method, url, headers, body })
    .then((res) => {
      if (plainJSON) {
        console.log(JSON.stringify(res));
        return;
      }

      console.log(colorMethod(method), color.bold(url));

      console.log(
        color.bold("  Status:"),
        colorStatus(`${res.status} ${STATUSES[res.status] ?? "UNKNOWN"}`),
      );

      const hidden = Object.fromEntries(
        Object.entries(res.headers).filter(
          commonHiddenFilters(showFullHeaders),
        ),
      );
      const hiddenLength =
        Object.keys(res.headers).length - Object.keys(hidden).length;

      console.log(
        color.bold("  Headers"),
        color.dim(`(${hiddenLength} hidden)`) + color.bold(":"),
      );

      Object.entries(hidden).forEach(([key, value]) =>
        console.log(`    ${key}: ${value}`),
      );

      let type = res.headers["content-type"];
      if (type) type = type.split(";")[0].trim();
      console.log(
        color.bold("  Body") +
          color.dim(type ? ` (${type})` : "") +
          color.bold(":"),
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
          .map(indent)
          .join("\n"),
      );

      if (inspected.split("\n").length > sliceLength && !showFullResponse) {
        console.log(
          color.dim(
            `    ...${inspected.split("\n").length - sliceLength} more lines (use`,
          ),
          color.yellow("--full-response"),
          color.dim("to see the whole response)"),
        );
      }
    })
    .catch((e) => {
      console.error(color.red("Failed to send request!"));

      if (e.message.toLowerCase().includes("invalid url"))
        console.error("You passed an invalid URL!");
      if (e.code === "ECONNREFUSED") console.error("Connection refused!");
      else console.error(e);

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
        return !hidden.includes(k);
      };
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

        return prepFetch({ method, url, headers, body });
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
