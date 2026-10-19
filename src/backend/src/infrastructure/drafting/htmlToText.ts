const NON_CONTENT_ELEMENTS = /<(head|script|style|noscript|template|svg|nav)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;
const BLOCK_BOUNDARIES =
  /<\/?(?:p|div|br|hr|li|ul|ol|h[1-6]|tr|table|thead|tbody|section|article|header|footer|blockquote|pre|dd|dt|dl)\b[^>]*>/gi;
const TABLE_CELLS = /<\/?t[dh]\b[^>]*>/gi;
const TAGS = /<[^>]+>/g;
const TITLE = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  sect: "§",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  bdquo: "„",
  ldquo: "“",
  rdquo: "”",
};

export function extractHtmlTitle(html: string): string | null {
  const title = TITLE.exec(html)?.[1];
  const text = title === undefined ? "" : collapseWhitespace(decodeEntities(title.replace(TAGS, "")));

  return text === "" ? null : text;
}

export function htmlToText(html: string): string {
  const text = html
    .replace(COMMENTS, "")
    .replace(NON_CONTENT_ELEMENTS, "")
    .replace(BLOCK_BOUNDARIES, "\n")
    .replace(TABLE_CELLS, " ")
    .replace(TAGS, "");

  return decodeEntities(text)
    .split("\n")
    .map(collapseWhitespace)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Entities are decoded last, so a decoded "&lt;" can never be mistaken for a tag.
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return fromCodePoint(Number.parseInt(body.slice(2), 16), entity);
    }

    if (body.startsWith("#")) {
      return fromCodePoint(Number.parseInt(body.slice(1), 10), entity);
    }

    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

function fromCodePoint(codePoint: number, fallback: string): string {
  return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : fallback;
}

function collapseWhitespace(text: string): string {
  return text.replace(/[ \t\r\f\v\u00a0]+/g, " ").trim();
}
