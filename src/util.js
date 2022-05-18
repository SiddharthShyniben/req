export const enum = (str) =>
  str
    .trim()
    .split(/\s+/)
    .reduce((obj, key) => {
      obj[key] = key;
      return obj;
    }, {});
