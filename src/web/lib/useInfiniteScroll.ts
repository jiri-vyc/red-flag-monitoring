"use client";

import { useEffect, useRef } from "react";

/** Loads the next page when the sentinel below the table scrolls into view; the button is the fallback. */
export function useInfiniteScroll({ canLoadMore, loadMore }: { canLoadMore: boolean; loadMore: () => void }) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !canLoadMore) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadMore();
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, loadMore]);
  return sentinelRef;
}
