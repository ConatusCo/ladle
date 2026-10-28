export const storyDelimiter = "-";
export const storyEncodeDelimiter = "$";

// BUT preserving delimiters --
const wordSeparators =
  /[\s\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,.\/:;<=>?@\[\]^_`{|}~]+/;

/**
 * @param {string} str
 */
export const capitalize = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * @param {string} str
 * @returns {{name: string; levels: string[]}}
 */
export const storyIdToMeta = (str) => {
  const parts = str
    .split(`${storyDelimiter}${storyDelimiter}`)
    .map((level) => capitalize(level.replace(/-/g, " ")));
  return {
    name: /** @type {string} */ (parts.pop()),
    levels: parts,
  };
};

/**
 * @param {string} str
 */
export const kebabCase = (str) => {
  return str
    .replace(/\s*--\s*/g, "xladledelimx")
    .replace(/\s*[-–—:]+\s*/g, " ")
    .replace(
      /[A-Z\u00C0-\u00D6\u00D9-\u00DD]+(?![a-z])|[A-Z\u00C0-\u00D6\u00D9-\u00DD]/g,
      ($, ofs) => (ofs ? "-" : "") + $.toLowerCase(),
    )
    .replace(/\s-/g, "-")
    .trim()
    .split(wordSeparators)
    .map((part) => part.replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .join("-")
    .replace(/xladledelimx/g, "--");
};

/**
 * @param {string} title
 * @param {string} [folderDelimiter]
 */
export const titleToFileId = (title, folderDelimiter = "/") => {
  const escaped = folderDelimiter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\s*${escaped}\\s*`, "g");
  return title
    .toLocaleLowerCase()
    .replace(regex, `${storyDelimiter}${storyDelimiter}`)
    .replace(/\s+/g, storyDelimiter);
};

/**
 * @param {string} filename
 */
export const getFileId = (filename) => {
  const pathParts = filename.split("/");
  return pathParts[pathParts.length - 1].split(".")[0];
};

/**
 * @param {string} fileId
 * @param {string} namedExport
 */
export const getEncodedStoryName = (fileId, namedExport) => {
  let encoded =
    `${fileId}${storyEncodeDelimiter}${storyEncodeDelimiter}${namedExport}`
      .toLocaleLowerCase()
      .replace(new RegExp(storyDelimiter, "g"), storyEncodeDelimiter);
  if (/^[0-9]/.test(encoded)) {
    encoded = `_${encoded}`;
  }
  return encoded;
};
