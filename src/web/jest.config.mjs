import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

// react-markdown, remark-gfm and the unified packages they pull in are ESM-only,
// so they have to go through the SWC transform. next/jest always prepends a
// pattern that ignores node_modules except its own transpiled packages, and
// custom config can only append to it, so the ESM packages are added to that pattern.
const ESM_PACKAGES = [
  "react-markdown",
  "remark-.*",
  "unified",
  "bail",
  "ccount",
  "character-.*",
  "comma-separated-tokens",
  "decode-named-character-reference",
  "devlop",
  "escape-string-regexp",
  "estree-util-.*",
  "hast-util-.*",
  "html-url-attributes",
  "is-.*",
  "longest-streak",
  "markdown-table",
  "mdast-util-.*",
  "micromark.*",
  "parse-entities",
  "property-information",
  "space-separated-tokens",
  "stringify-entities",
  "trim-lines",
  "trough",
  "unist-util-.*",
  "vfile.*",
  "zwitch",
];
const NEXT_NODE_MODULES_PREFIX = "/node_modules/(?!.pnpm)(?!(";

const nextConfig = createJestConfig({
  testEnvironment: "jsdom",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
});

export default async function jestConfig() {
  const config = await nextConfig();
  const patterns = config.transformIgnorePatterns;
  if (!patterns.some((pattern) => pattern.startsWith(NEXT_NODE_MODULES_PREFIX))) {
    throw new Error("next/jest node_modules transformIgnorePattern changed; update jest.config.mjs");
  }
  return {
    ...config,
    transformIgnorePatterns: patterns.map((pattern) =>
      pattern.startsWith(NEXT_NODE_MODULES_PREFIX)
        ? pattern.replace(NEXT_NODE_MODULES_PREFIX, `${NEXT_NODE_MODULES_PREFIX}${ESM_PACKAGES.join("|")}|`)
        : pattern,
    ),
  };
}
