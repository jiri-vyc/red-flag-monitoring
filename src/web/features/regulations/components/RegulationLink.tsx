"use client";

import { Scale } from "lucide-react";
import Link from "next/link";

import { useRegulations } from "../api/hooks";
import styles from "./RegulationLink.module.css";

/** Link with the regulation's short name; resolved from the cached regulation list. */
export function RegulationLink({ regulationId }: { regulationId: string }) {
  const regulationsQuery = useRegulations();
  const regulation = regulationsQuery.data?.find((candidate) => candidate.id === regulationId);
  return (
    <Link href={`/regulations/${regulationId}`} className={styles.link}>
      <Scale aria-hidden="true" />
      {regulation?.shortName ?? regulationId}
    </Link>
  );
}
