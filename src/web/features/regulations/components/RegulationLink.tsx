"use client";

import { Scale } from "lucide-react";
import Link from "next/link";

import { useRegulationNames } from "../api/hooks";
import styles from "./RegulationLink.module.css";

/** Link with the regulation's short name from the cached name index; the id while it loads or when unknown. */
export function RegulationLink({ regulationId }: { regulationId: string }) {
  const regulationNamesQuery = useRegulationNames();
  return (
    <Link href={`/regulations/${regulationId}`} className={styles.link}>
      <Scale aria-hidden="true" />
      {regulationNamesQuery.data?.[regulationId] ?? regulationId}
    </Link>
  );
}
