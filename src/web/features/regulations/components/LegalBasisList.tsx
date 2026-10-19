"use client";

import type { LegalBasis } from "../types";
import styles from "./LegalBasisList.module.css";
import { RegulationLink } from "./RegulationLink";

type LegalBasisListProps = {
  legalBases: LegalBasis[];
  /** Shown when nothing is cited, e.g. a purely internal policy (M3). */
  emptyLabel: string;
};

/** The cited regulations as links, each with its provision ref (M2: refs are free text). */
export function LegalBasisList({ legalBases, emptyLabel }: LegalBasisListProps) {
  if (legalBases.length === 0) {
    return <span className={styles.empty}>{emptyLabel}</span>;
  }
  return (
    <ul className={styles.list}>
      {legalBases.map(({ regulationId, ref }) => (
        <li key={`${regulationId}|${ref ?? ""}`} className={styles.item}>
          <RegulationLink regulationId={regulationId} />
          {ref !== null && <span className={styles.ref}>{ref}</span>}
        </li>
      ))}
    </ul>
  );
}
