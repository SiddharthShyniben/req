import JSONC from "jsonc-simple-parser";

const METHODS = [
  "DELETE",
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "CONNECT",
  "OPTIONS",
  "TRACE",
  "COPY",
  "LOCK",
  "MKCOL",
  "MOVE",
  "PROPFIND",
  "PROPPATCH",
  "SEARCH",
  "UNLOCK",
  "BIND",
  "REBIND",
  "UNBIND",
  "ACL",
  "REPORT",
  "MKACTIVITY",
  "CHECKOUT",
  "MERGE",
  "M-SEARCH",
  "NOTIFY",
  "SUBSCRIBE",
  "UNSUBSCRIBE",
  "PATCH",
  "PURGE",
  "MKCALENDAR",
  "LINK",
  "UNLINK",
];
const HTTP_VERSIONS = ["0.9", "1.0", "1.1", "2.0"];

const requestRegex = /^([A-Z-]+) ([^ ]+) HTTP\/(\d)\.(\d)$/;
const versionRegex = /HTTP\/(\d)\.(\d)$/;
const headerRegex = /^([^: \t]+):[ \t]*((?:.*[^ \t])|)/;
const continuationRegex = /^[ \t]+(.*[^ \t])/;

const clean = (line) =>
  line
    .replace(/^\/\/.+/g, "")
    .replace(/^#.+/g, "")
    .trim();

export function parse(text) {
  const ret = {
    headers: {},
  };

  const lines = text.split("\n");

  let parsedRequest = false;
  let parsedHeaders = false;
  let finalLine = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (!clean(line)) {
      if (!parsedRequest) continue;
      else if (!parsedHeaders) {
        parsedHeaders = true;
        continue;
      }
    }

    if (!parsedRequest) {
      let nextLine = lines[i + 1];
      while (nextLine && clean(nextLine) && continuationRegex.test(nextLine)) {
        const [, l] = nextLine.match(continuationRegex);
        if (versionRegex.test(l)) line += " ";
        line += l;
        i++;
        nextLine = lines[i + 1];
        if (!nextLine || !clean(nextLine) || !continuationRegex.test(nextLine))
          break;
      }

      const match = line.match(requestRegex);

      if (!match) {
        throw new Error(`Error on line ${line}: Expected request line`);
      }

      const [, method, url, httpVersionMajor, httpVersionMinor] = match;
      const realVersion = `${httpVersionMajor}.${httpVersionMinor}`;

      if (!METHODS.includes(method)) {
        throw new Error(`Error on line ${line}: Invalid method ${method}`);
      }

      if (!HTTP_VERSIONS.includes(realVersion)) {
        throw new Error(
          `Error on line ${line}: Invalid HTTP version ${realVersion}`
        );
      }

      ret.method = method;
      ret.url = url;
      ret.version = realVersion;

      parsedRequest = true;
    } else if (!parsedHeaders) {
      let nextLine = lines[i + 1];

      while (nextLine && clean(nextLine) && continuationRegex.test(nextLine)) {
        const [, l] = nextLine.match(continuationRegex);
        line += l;
        i++;
        nextLine = lines[i + 1];
        if (!nextLine || !clean(nextLine) || !continuationRegex.test(nextLine))
          break;
      }

      const match = line.match(headerRegex);

      if (!match) throw new Error(`Error on line ${line}: Expected header`);
      const [, header, value] = match;
      ret.headers[header] = value;
    } else {
      finalLine = i;
      break;
    }
  }

  if (finalLine === 0) return ret;

  const { body, type } = toBody(lines.slice(finalLine).join("\n"));
  ret.body = body;
  const types = { json: ["Content-Type", "application/json"] };
  if (types[type]) ret.headers[types[type][0]] = types[type][1];

  return ret;
}

function toBody(source) {
  try {
    const parsed = JSONC.parse(source);

    return {
      body: JSONC.stringify(parsed),
      type: "json",
    };
  } catch (e) {
    return {
      body: source,
      type: "raw",
    };
  }
}
