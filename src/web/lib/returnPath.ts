export const RETURN_PATH_PARAM = "from";

// Browsers treat "\" like "/" and drop tabs and newlines from URLs, so "/\evil.com" or "/\t/evil.com"
// would become the protocol-relative "//evil.com". Any of them disqualifies the path.
const UNSAFE_CHARACTERS = /[\\\s\p{Cc}]/u;

export function isSafeInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !UNSAFE_CHARACTERS.test(path);
}

export function withReturnPath(href: string, returnPath: string): string {
  return `${href}?${RETURN_PATH_PARAM}=${encodeURIComponent(returnPath)}`;
}

export function readReturnPath(value: string | string[] | undefined): string | null {
  return typeof value === "string" && isSafeInternalPath(value) ? value : null;
}
