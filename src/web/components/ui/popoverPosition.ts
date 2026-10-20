export type AnchorRect = { top: number; right: number; bottom: number; left: number };
export type Size = { width: number; height: number };
export type PopoverPlacement = "right" | "left" | "bottom" | "top";

export type PopoverPosition = {
  placement: PopoverPlacement;
  top: number;
  left: number;
  /** Caps the popover to the viewport; taller content scrolls inside it. */
  maxHeight: number;
  maxWidth: number;
};

type PositionInput = {
  anchor: AnchorRect;
  /** The popover's natural size, before any cap. */
  popover: Size;
  viewport: Size;
  /** Space between the anchor and the popover. */
  gap?: number;
  /** Space the popover keeps from the viewport edges. */
  margin?: number;
};

/** Default space a popover keeps from the viewport edges. */
export const VIEWPORT_MARGIN = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Places a popover next to its anchor so it always stays fully inside the viewport: right of the anchor if it fits,
 * else left, else below or above it; then shifts it within the margins. All values are viewport (fixed) pixels.
 */
export function computePopoverPosition({
  anchor,
  popover,
  viewport,
  gap = 8,
  margin = VIEWPORT_MARGIN,
}: PositionInput): PopoverPosition {
  const maxWidth = Math.max(viewport.width - 2 * margin, 0);
  const maxHeight = Math.max(viewport.height - 2 * margin, 0);
  const width = Math.min(popover.width, maxWidth);
  const height = Math.min(popover.height, maxHeight);
  const fitsRight = anchor.right + gap + width <= viewport.width - margin;
  const fitsLeft = anchor.left - gap - width >= margin;
  const fitsBelow = anchor.bottom + gap + height <= viewport.height - margin;

  let placement: PopoverPlacement;
  let top: number;
  let left: number;
  if (fitsRight || fitsLeft) {
    placement = fitsRight ? "right" : "left";
    left = fitsRight ? anchor.right + gap : anchor.left - gap - width;
    top = anchor.top;
  } else {
    placement = fitsBelow ? "bottom" : "top";
    left = anchor.left;
    top = fitsBelow ? anchor.bottom + gap : anchor.top - gap - height;
  }

  return {
    placement,
    top: clamp(top, margin, viewport.height - margin - height),
    left: clamp(left, margin, viewport.width - margin - width),
    maxHeight,
    maxWidth,
  };
}
