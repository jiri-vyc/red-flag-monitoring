import { parseOffsetCursor } from "./offsetCursor";

describe("parseOffsetCursor", () => {
  it("reads a whole non-negative offset", () => {
    expect(parseOffsetCursor("25")).toBe(25);
    expect(parseOffsetCursor("0")).toBe(0);
  });

  it.each([null, "", "abc", "-25", "2.5", "Infinity", "1e400"])("reads %p as the first page", (cursor) => {
    expect(parseOffsetCursor(cursor)).toBe(0);
  });
});
