"use client";

import { useState } from "react";

import { Field, fieldStyles } from "@/components/ui/Field";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";

import { countDiffChanges, diffLines, type DiffLine } from "../domain/lineDiff";
import type { PolicyVersion } from "../types";
import styles from "./PolicyVersionDiff.module.css";

type PolicyVersionDiffProps = {
  /** Oldest first, at least two. */
  versions: PolicyVersion[];
};

const MARKERS: Record<DiffLine["kind"], string> = { added: "+", removed: "−", unchanged: " " };

function VersionSelect({
  id,
  label,
  versions,
  value,
  onChange,
}: {
  id: string;
  label: string;
  versions: PolicyVersion[];
  value: number;
  onChange: (versionNumber: number) => void;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <select
        id={id}
        className={fieldStyles.select}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {versions.toReversed().map((version) => (
          <option key={version.versionNumber} value={version.versionNumber}>
            v{version.versionNumber}
          </option>
        ))}
      </select>
    </Field>
  );
}

function DiffLineContent({ line }: { line: DiffLine }) {
  const { t } = useI18n();
  // Screen readers do not announce <ins>/<del> everywhere, so the kind is also spelled out.
  if (line.kind === "added") {
    return (
      <ins>
        <span className="visually-hidden">{t.policies.diffAdded} </span>
        {line.text}
      </ins>
    );
  }
  if (line.kind === "removed") {
    return (
      <del>
        <span className="visually-hidden">{t.policies.diffRemoved} </span>
        {line.text}
      </del>
    );
  }
  return <span>{line.text}</span>;
}

/** Line diff of two policy versions' texts; defaults to the newest version against the one before it. */
export function PolicyVersionDiff({ versions }: PolicyVersionDiffProps) {
  const { t } = useI18n();
  const [fromVersionNumber, setFromVersionNumber] = useState(versions.at(-2)?.versionNumber ?? 0);
  const [toVersionNumber, setToVersionNumber] = useState(versions.at(-1)?.versionNumber ?? 0);
  const fromVersion = versions.find((version) => version.versionNumber === fromVersionNumber);
  const toVersion = versions.find((version) => version.versionNumber === toVersionNumber);
  const lines = fromVersion && toVersion ? diffLines(fromVersion.text, toVersion.text) : [];
  const changes = countDiffChanges(lines);
  const hasChanges = changes.added + changes.removed > 0;
  const title = formatMessage(t.policies.diffTitle, { from: fromVersionNumber, to: toVersionNumber });

  return (
    <div className={styles.diff}>
      <div className={styles.selects}>
        <VersionSelect
          id="policy-diff-from"
          label={t.policies.compareFrom}
          versions={versions}
          value={fromVersionNumber}
          onChange={setFromVersionNumber}
        />
        <VersionSelect
          id="policy-diff-to"
          label={t.policies.compareTo}
          versions={versions}
          value={toVersionNumber}
          onChange={setToVersionNumber}
        />
      </div>
      {hasChanges ? (
        <>
          <p className={styles.summary}>{formatMessage(t.policies.diffSummary, changes)}</p>
          <ol className={styles.lines} aria-label={title}>
            {lines.map((line, index) => (
              <li key={index} className={styles[line.kind]}>
                <span className={styles.marker} aria-hidden="true">
                  {MARKERS[line.kind]}
                </span>
                <DiffLineContent line={line} />
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className={styles.summary}>{t.policies.diffIdentical}</p>
      )}
    </div>
  );
}
