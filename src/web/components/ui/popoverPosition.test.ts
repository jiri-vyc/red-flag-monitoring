import { computePopoverPosition } from "./popoverPosition";

const VIEWPORT = { width: 1200, height: 800 };
// A sidebar icon near the bottom left corner.
const ANCHOR = { top: 700, left: 20, right: 50, bottom: 730 };

describe("computePopoverPosition", () => {
  it("places the popover right of the anchor, aligned to its top, when it fits", () => {
    expect(
      computePopoverPosition({ anchor: ANCHOR, popover: { width: 300, height: 50 }, viewport: VIEWPORT }),
    ).toEqual({ placement: "right", top: 700, left: 58, maxHeight: 784, maxWidth: 1184 });
  });

  it("shifts the popover up so it does not overflow the bottom edge", () => {
    const position = computePopoverPosition({
      anchor: ANCHOR,
      popover: { width: 300, height: 400 },
      viewport: VIEWPORT,
    });

    expect(position.top).toBe(800 - 8 - 400);
  });

  it("flips to the left of the anchor when there is no space on the right", () => {
    const anchor = { top: 100, left: 1000, right: 1030, bottom: 130 };
    const position = computePopoverPosition({
      anchor,
      popover: { width: 300, height: 200 },
      viewport: VIEWPORT,
    });

    expect(position).toMatchObject({ placement: "left", left: 1000 - 8 - 300, top: 100 });
  });

  it("goes below the anchor and clamps it to the right edge when neither side has space", () => {
    const anchor = { top: 100, left: 300, right: 330, bottom: 130 };
    const viewport = { width: 600, height: 800 };
    const position = computePopoverPosition({ anchor, popover: { width: 400, height: 200 }, viewport });

    expect(position).toMatchObject({ placement: "bottom", top: 138, left: 600 - 8 - 400 });
  });

  it("goes above the anchor when there is no space below either", () => {
    const anchor = { top: 700, left: 300, right: 330, bottom: 730 };
    const viewport = { width: 600, height: 800 };
    const position = computePopoverPosition({ anchor, popover: { width: 400, height: 200 }, viewport });

    expect(position).toMatchObject({ placement: "top", top: 700 - 8 - 200 });
  });

  it("caps the height to the viewport and pins a taller popover to the top margin", () => {
    const position = computePopoverPosition({
      anchor: ANCHOR,
      popover: { width: 300, height: 2000 },
      viewport: VIEWPORT,
    });

    expect(position).toMatchObject({ top: 8, maxHeight: 784 });
  });

  it("caps the width to a narrow viewport and keeps the popover inside it", () => {
    const viewport = { width: 320, height: 600 };
    const position = computePopoverPosition({
      anchor: ANCHOR,
      popover: { width: 500, height: 100 },
      viewport,
    });

    expect(position).toMatchObject({ left: 8, maxWidth: 304 });
  });
});
