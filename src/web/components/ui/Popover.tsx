"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import styles from "./Popover.module.css";
import { computePopoverPosition, VIEWPORT_MARGIN } from "./popoverPosition";

// Lets the pointer cross the gap between the trigger and the popover without closing it.
const CLOSE_DELAY_MS = 150;

const subscribeToNothing = () => () => {};

/**
 * Positions the popover in the viewport; writes the styles directly so scrolling does not re-render. It never resets
 * max-height, so repositioning keeps the popover's own scroll position.
 */
function placePopover(trigger: HTMLElement | null, popover: HTMLElement | null): void {
  if (!trigger || !popover) {
    return;
  }
  const viewport = {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  };
  // Width first, so the height below is measured with the text wrapped as it will be. Same value until a resize.
  popover.style.maxWidth = `${Math.max(viewport.width - 2 * VIEWPORT_MARGIN, 0)}px`;
  // Natural height even while capped: content and padding (scrollHeight) plus borders.
  const borderHeight = popover.offsetHeight - popover.clientHeight;
  const position = computePopoverPosition({
    anchor: trigger.getBoundingClientRect(),
    popover: { width: popover.offsetWidth, height: popover.scrollHeight + borderHeight },
    viewport,
  });
  popover.style.top = `${position.top}px`;
  popover.style.left = `${position.left}px`;
  popover.style.maxHeight = `${position.maxHeight}px`;
  popover.style.maxWidth = `${position.maxWidth}px`;
}

type PopoverProps = {
  /** Accessible name of the trigger button. */
  triggerLabel: string;
  triggerClassName?: string;
  /** The trigger's visible content, e.g. an icon. */
  trigger: ReactNode;
  children: ReactNode;
};

/**
 * Rich tooltip: opens on hover, focus or tap and closes on Escape, blur or a tap outside. Rendered in a portal so a
 * scrolling container cannot clip it, and kept fully inside the viewport (see computePopoverPosition).
 */
export function Popover({ triggerLabel, triggerClassName, trigger, children }: PopoverProps) {
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);
  // The portal needs document.body, which the server render does not have.
  const isClient = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const open = () => {
    cancelClose();
    setIsOpen(true);
  };
  const close = () => {
    cancelClose();
    setIsOpen(false);
  };
  // Clicking inside the popover (e.g. its scrollbar) moves focus there, which must not close it.
  const closeWhenFocusLeaves = (event: FocusEvent) => {
    const focusTarget = event.relatedTarget as Node | null;
    if (!triggerRef.current?.contains(focusTarget) && !popoverRef.current?.contains(focusTarget)) {
      close();
    }
  };
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setIsOpen(false), CLOSE_DELAY_MS);
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }
    const updatePosition = () => placePopover(triggerRef.current, popoverRef.current);
    // Scrolling inside the popover does not move the trigger, so it must not reposition (or disturb) it.
    const updatePositionOnScroll = (event: Event) => {
      if (!popoverRef.current?.contains(event.target as Node)) {
        updatePosition();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    const closeOnPointerOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    // Capture scrolling of any container, e.g. the sidebar, not only the window.
    window.addEventListener("scroll", updatePositionOnScroll, true);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnPointerOutside);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePositionOnScroll, true);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnPointerOutside);
    };
  }, [isOpen]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={triggerLabel}
        aria-describedby={popoverId}
        onMouseEnter={open}
        onMouseLeave={closeSoon}
        onFocus={open}
        onBlur={closeWhenFocusLeaves}
        onClick={open}
      >
        {trigger}
      </button>
      {isClient &&
        createPortal(
          <div
            ref={popoverRef}
            id={popoverId}
            role="tooltip"
            tabIndex={-1}
            hidden={!isOpen}
            className={styles.popover}
            onMouseEnter={open}
            onMouseLeave={closeSoon}
            onBlur={closeWhenFocusLeaves}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
