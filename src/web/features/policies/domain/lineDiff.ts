export type DiffLineKind = "added" | "removed" | "unchanged";

export type DiffLine = { kind: DiffLineKind; text: string };

function splitLines(text: string): string[] {
  return text === "" ? [] : text.replace(/\r\n?/g, "\n").split("\n");
}

function toDiffLines(kind: DiffLineKind, lines: string[]): DiffLine[] {
  return lines.map((text) => ({ kind, text }));
}

/** Longest common subsequence table: `table[i][j]` is the LCS length of `oldLines[i..]` and `newLines[j..]`. */
function buildLcsTable(oldLines: string[], newLines: string[]): number[][] {
  const table = Array.from({ length: oldLines.length + 1 }, () =>
    new Array<number>(newLines.length + 1).fill(0),
  );
  for (let i = oldLines.length - 1; i >= 0; i--) {
    for (let j = newLines.length - 1; j >= 0; j--) {
      table[i][j] =
        oldLines[i] === newLines[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

function diffByLcs(oldLines: string[], newLines: string[]): DiffLine[] {
  const table = buildLcsTable(oldLines, newLines);
  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < oldLines.length && j < newLines.length) {
    if (oldLines[i] === newLines[j]) {
      result.push({ kind: "unchanged", text: oldLines[i] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      // Removals before additions, so a changed line reads as "old, then new".
      result.push({ kind: "removed", text: oldLines[i] });
      i++;
    } else {
      result.push({ kind: "added", text: newLines[j] });
      j++;
    }
  }
  return [
    ...result,
    ...toDiffLines("removed", oldLines.slice(i)),
    ...toDiffLines("added", newLines.slice(j)),
  ];
}

/**
 * Line-based diff of two texts (LCS). The common start and end are matched first,
 * so the quadratic table only covers the changed middle of the text.
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);
  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) {
    start++;
  }
  let oldEnd = oldLines.length;
  let newEnd = newLines.length;
  while (oldEnd > start && newEnd > start && oldLines[oldEnd - 1] === newLines[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return [
    ...toDiffLines("unchanged", oldLines.slice(0, start)),
    ...diffByLcs(oldLines.slice(start, oldEnd), newLines.slice(start, newEnd)),
    ...toDiffLines("unchanged", oldLines.slice(oldEnd)),
  ];
}

export function countDiffChanges(lines: DiffLine[]): { added: number; removed: number } {
  return {
    added: lines.filter((line) => line.kind === "added").length,
    removed: lines.filter((line) => line.kind === "removed").length,
  };
}
