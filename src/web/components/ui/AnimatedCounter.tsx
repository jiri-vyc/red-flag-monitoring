"use client";

import { useEffect, useRef, useState } from "react";

const ANIMATION_DURATION_MS = 900;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Counts up from the previously shown value to `value` with an ease-out curve. */
export function AnimatedCounter({ value, format }: { value: number; format?: (value: number) => string }) {
  const [displayedValue, setDisplayedValue] = useState(0);
  const displayedValueRef = useRef(0);

  useEffect(() => {
    const startValue = displayedValueRef.current;
    if (prefersReducedMotion() || startValue === value) {
      displayedValueRef.current = value;
      const frameId = requestAnimationFrame(() => setDisplayedValue(value));
      return () => cancelAnimationFrame(frameId);
    }
    const startTime = performance.now();
    let frameId = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startTime) / ANIMATION_DURATION_MS);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(startValue + (value - startValue) * easedProgress);
      displayedValueRef.current = nextValue;
      setDisplayedValue(nextValue);
      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {format ? format(displayedValue) : displayedValue}
    </span>
  );
}
