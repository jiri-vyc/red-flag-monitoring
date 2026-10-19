// Checks of a machine-drafted internal policy against the regulation it was drafted from.

// Policies give every monitoring rule its own heading, e.g. "### Čl. 5 R-07 …" or "### R-01 …".
const RULE_ID_IN_HEADING = /(?:^|\s)(R-\d{2,})(?=\s|$)/g;
// Each rule article cites the regulation verbatim, e.g. "**Citace regulace (bod 11.13 a):** „…“".
const REGULATION_QUOTE_LINE_MARKER = "Citace regulace";
const CZECH_QUOTE = /„([^“]+)“/g;

export function findDefinedRuleIds(policyBody: string): string[] {
  const ruleIds = policyBody
    .split("\n")
    .filter((line) => line.startsWith("#"))
    .flatMap((heading) => capturedGroups(heading.replace(/^#+/, ""), RULE_ID_IN_HEADING));

  return [...new Set(ruleIds)];
}

export function findRegulationQuotes(policyBody: string): string[] {
  return policyBody
    .split("\n")
    .filter((line) => line.includes(REGULATION_QUOTE_LINE_MARKER))
    .flatMap((line) => capturedGroups(line, CZECH_QUOTE));
}

// A quote is trusted only when it appears verbatim in the regulation text; this catches hallucinated citations.
export function findUnverifiedQuotes(quotes: string[], regulationText: string): string[] {
  const normalizedRegulationText = normalizeWhitespace(regulationText);

  return quotes.filter((quote) => !normalizedRegulationText.includes(normalizeWhitespace(quote)));
}

// Returns the section whose heading contains headingText, up to its next sibling or a higher-level heading.
// Lets a long regulation be narrowed to one part, e.g. "Obecný pokyn č. 11" of EBA/GL/2021/02.
// Texts converted from PDF often put subsections ("## Opatření") on the same level as the section itself, so a
// sibling is a same-level heading that starts like this one up to its number ("Obecný pokyn č.", "§").
export function findMarkdownSection(markdown: string, headingText: string): string | null {
  const lines = markdown.split("\n");
  const headingIndex = lines.findIndex((line) => line.startsWith("#") && line.includes(headingText));
  const heading = lines[headingIndex];

  if (heading === undefined) {
    return null;
  }

  const headingLevel = headingDepth(heading);
  const siblingPrefix = numberingPrefix(heading);
  const nextSectionOffset = lines
    .slice(headingIndex + 1)
    .findIndex(
      (line) =>
        line.startsWith("#") &&
        (headingDepth(line) < headingLevel ||
          (headingDepth(line) === headingLevel && numberingPrefix(line) === siblingPrefix)),
    );
  const endIndex = nextSectionOffset === -1 ? lines.length : headingIndex + 1 + nextSectionOffset;

  return lines.slice(headingIndex, endIndex).join("\n").trim();
}

function capturedGroups(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
}

// Heading text before its first digit, e.g. "Obecný pokyn č." for "## Obecný pokyn č. 11: …". A heading without
// a number has the whole text as prefix, so only an identical heading counts as its sibling.
function numberingPrefix(headingLine: string): string {
  const text = headingLine.replace(/^#+/, "").trim();
  const firstDigitIndex = text.search(/\d/);

  return (firstDigitIndex === -1 ? text : text.slice(0, firstDigitIndex)).trim();
}

function headingDepth(line: string): number {
  return line.match(/^#+/)?.[0].length ?? 0;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
