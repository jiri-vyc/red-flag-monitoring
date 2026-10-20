"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";
import { formatTime } from "@/lib/format";

import type { RunStall } from "../api/hooks";

/** Shown once a processing run stops progressing; the run stays processing, the backend owns its status. */
export function RunStalledNotice({ runStall }: { runStall: RunStall }) {
  const { t, locale } = useI18n();
  if (runStall.stalledSinceMs === null) {
    return null;
  }
  return (
    <Notice
      tone="compliance"
      actions={
        <Button variant="ghost" icon={<RefreshCw aria-hidden="true" />} onClick={runStall.checkAgain}>
          {t.batches.runStalledCheckAgain}
        </Button>
      }
    >
      {formatMessage(t.batches.runStalled, {
        time: formatTime(new Date(runStall.stalledSinceMs).toISOString(), locale),
      })}
    </Notice>
  );
}
