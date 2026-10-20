"use client";

import { FileText } from "lucide-react";
import Link from "next/link";

import styles from "@/features/regulations/components/RegulationLink.module.css";

import { usePolicyNames } from "../api/hooks";

/** Link with the policy's name from the cached name index; the id while it loads or when the name is unknown. */
export function PolicyLink({ policyId }: { policyId: string }) {
  const policyNamesQuery = usePolicyNames();
  return (
    <Link href={`/policies/${policyId}`} className={styles.link}>
      <FileText aria-hidden="true" />
      {policyNamesQuery.data?.[policyId] ?? policyId}
    </Link>
  );
}
