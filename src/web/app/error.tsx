"use client";

import { ErrorState } from "@/components/ui/StateViews";

export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState error={error} onRetry={retry} />;
}
