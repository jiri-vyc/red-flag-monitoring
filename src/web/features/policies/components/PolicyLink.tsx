"use client";

import { FileText } from "lucide-react";
import Link from "next/link";

import styles from "@/features/regulations/components/RegulationLink.module.css";

import { usePolicies } from "../api/hooks";

/** Link with the policy's name; resolved from the cached policy list. */
export function PolicyLink({ policyId }: { policyId: string }) {
  const policiesQuery = usePolicies();
  const policy = policiesQuery.data?.find((candidate) => candidate.id === policyId);
  return (
    <Link href={`/policies/${policyId}`} className={styles.link}>
      <FileText aria-hidden="true" />
      {policy?.name ?? policyId}
    </Link>
  );
}
