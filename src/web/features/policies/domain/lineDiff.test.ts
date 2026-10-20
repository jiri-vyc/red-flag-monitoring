import { countDiffChanges, diffLines, type DiffLine } from "./lineDiff";

const unchanged = (text: string): DiffLine => ({ kind: "unchanged", text });
const added = (text: string): DiffLine => ({ kind: "added", text });
const removed = (text: string): DiffLine => ({ kind: "removed", text });

describe("diffLines", () => {
  it("keeps identical texts unchanged", () => {
    expect(diffLines("a\nb", "a\nb")).toEqual([unchanged("a"), unchanged("b")]);
  });

  it("treats an empty text as no lines", () => {
    expect(diffLines("", "")).toEqual([]);
    expect(diffLines("", "a\nb")).toEqual([added("a"), added("b")]);
    expect(diffLines("a", "")).toEqual([removed("a")]);
  });

  it("marks added and removed lines around the unchanged ones", () => {
    expect(diffLines("a\nb\nc\nd", "a\nc\nd\ne")).toEqual([
      unchanged("a"),
      removed("b"),
      unchanged("c"),
      unchanged("d"),
      added("e"),
    ]);
  });

  it("shows a changed line as the old one removed, then the new one added", () => {
    expect(diffLines("a\nlimit 10 000\nz", "a\nlimit 15 000\nz")).toEqual([
      unchanged("a"),
      removed("limit 10 000"),
      added("limit 15 000"),
      unchanged("z"),
    ]);
  });

  it("finds the longest common lines when the middle is reordered", () => {
    const lines = diffLines("x\na\nb\nc\ny", "x\nc\na\nb\ny");

    expect(lines.filter((line) => line.kind === "unchanged").map((line) => line.text)).toEqual([
      "x",
      "a",
      "b",
      "y",
    ]);
    expect(countDiffChanges(lines)).toEqual({ added: 1, removed: 1 });
  });

  it("ignores Windows line endings", () => {
    expect(diffLines("a\r\nb", "a\nb")).toEqual([unchanged("a"), unchanged("b")]);
  });
});

describe("countDiffChanges", () => {
  it("counts added and removed lines", () => {
    expect(countDiffChanges([unchanged("a"), added("b"), added("c"), removed("d")])).toEqual({
      added: 2,
      removed: 1,
    });
  });
});
