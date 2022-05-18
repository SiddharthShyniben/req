import { parse } from "ini-parser";
import { readFileSync } from "fs";

export function getVariables() {
  const file = readFileSync(".reqrc", "utf8");
  const parsed = parse(file);
  return parsed.variables ?? {};
}
