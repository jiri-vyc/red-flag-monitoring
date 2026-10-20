import { fireEvent, render, screen } from "@testing-library/react";

import { Popover } from "./Popover";

function setViewportSize(width: number, height: number) {
  Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: width });
  Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: height });
}

function renderOpenPopover() {
  render(
    <>
      <div data-testid="scroll-container" />
      <Popover triggerLabel="Roles" trigger="i">
        <p>Long content</p>
      </Popover>
    </>,
  );
  const trigger = screen.getByRole("button", { name: "Roles" });
  const popover = screen.getByRole("tooltip", { hidden: true });
  const moveTriggerTo = (top: number) =>
    jest
      .spyOn(trigger, "getBoundingClientRect")
      .mockReturnValue({ top, bottom: top + 30, left: 10, right: 40 } as DOMRect);
  moveTriggerTo(100);
  fireEvent.mouseEnter(trigger);
  return { popover, moveTriggerTo };
}

describe("Popover scrolling", () => {
  beforeEach(() => setViewportSize(1000, 800));

  it("opens next to the trigger with a viewport-capped height", () => {
    const { popover } = renderOpenPopover();

    expect(popover.hidden).toBe(false);
    expect(popover.style).toMatchObject({ top: "100px", left: "48px", maxHeight: "784px" });
  });

  it("does not touch its styles when the popover itself scrolls, so its scroll position is kept", () => {
    const { popover, moveTriggerTo } = renderOpenPopover();
    moveTriggerTo(300);

    fireEvent.scroll(popover);

    expect(popover.style).toMatchObject({ top: "100px", maxHeight: "784px" });
  });

  it("repositions when another container scrolls, without resetting the max height", () => {
    const { popover, moveTriggerTo } = renderOpenPopover();
    moveTriggerTo(300);

    fireEvent.scroll(screen.getByTestId("scroll-container"));

    expect(popover.style).toMatchObject({ top: "300px", maxHeight: "784px" });
  });
});
