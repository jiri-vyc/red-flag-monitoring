"use client";

import { Plus, ShieldOff, UserMinus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import tableStyles from "@/components/ui/DataTable.module.css";
import { Field, fieldStyles } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { EmptyState, ErrorState, QueryView } from "@/components/ui/StateViews";
import { useI18n } from "@/i18n/I18nProvider";
import { formatDateTime } from "@/lib/format";
// Demo client IDs, offered only when the rules service can suggest clients (the mock).
import { SEED_CLIENTS } from "@/mocks/seed/clients";
import { useRolePermissions } from "@/features/users/api/hooks";

import {
  useAddWhitelistEntry,
  useRemoveWhitelistEntry,
  useRulesCapabilities,
  useRuleWhitelist,
} from "../api/hooks";
import type { Rule, WhitelistEntry } from "../types";
import {
  validateWhitelistEntryForm,
  type WhitelistEntryFormResult,
  type WhitelistEntryFormValues,
} from "../whitelistEntryForm";
import styles from "./RuleWhitelistCard.module.css";

const EMPTY_FORM: WhitelistEntryFormValues = { clientId: "", reason: "" };
const CLIENT_SUGGESTIONS_ID = "rule-whitelist-clients";

type FormErrors = Extract<WhitelistEntryFormResult, { isValid: false }>["errors"];

function WhitelistTable({
  ruleId,
  entries,
  canEdit,
}: {
  ruleId: string;
  entries: WhitelistEntry[];
  /** Issue #6: only the compliance officer changes the whitelist. */
  canEdit: boolean;
}) {
  const { t, locale } = useI18n();
  const removeMutation = useRemoveWhitelistEntry();
  if (entries.length === 0) {
    return <EmptyState message={t.whitelist.empty} />;
  }
  return (
    <>
      <div className={tableStyles.wrapper}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th scope="col">{t.whitelist.clientId}</th>
              <th scope="col">{t.whitelist.reason}</th>
              <th scope="col">{t.whitelist.createdBy}</th>
              <th scope="col">
                <span className="visually-hidden">{t.whitelist.remove}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.clientId}>
                <td className={tableStyles.mono}>{entry.clientId}</td>
                <td className={styles.reason}>{entry.reason}</td>
                <td>
                  <span className={tableStyles.primaryCell}>
                    {entry.createdBy}
                    <span className={tableStyles.secondaryText}>
                      {formatDateTime(entry.createdAt, locale)}
                    </span>
                  </span>
                </td>
                <td>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      icon={<UserMinus aria-hidden="true" />}
                      aria-label={`${t.whitelist.removeLabel} ${entry.clientId}`}
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate({ ruleId, clientId: entry.clientId })}
                    >
                      {t.whitelist.remove}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {removeMutation.error && <ErrorState error={removeMutation.error} />}
    </>
  );
}

function AddWhitelistEntryForm({ ruleId }: { ruleId: string }) {
  const { t } = useI18n();
  const addMutation = useAddWhitelistEntry();
  const { canSuggestWhitelistClients } = useRulesCapabilities();
  const [values, setValues] = useState<WhitelistEntryFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  const updateValues = (changes: Partial<WhitelistEntryFormValues>) =>
    setValues((current) => ({ ...current, ...changes }));
  const translateError = (field: keyof WhitelistEntryFormValues) => {
    const errorKey = errors[field];
    return errorKey ? t.whitelist[errorKey] : null;
  };

  const submitForm = () => {
    const validationResult = validateWhitelistEntryForm(values);
    if (!validationResult.isValid) {
      setErrors(validationResult.errors);
      return;
    }
    setErrors({});
    addMutation.mutate({ ruleId, ...validationResult.input }, { onSuccess: () => setValues(EMPTY_FORM) });
  };

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submitForm();
      }}
    >
      <Field
        label={t.whitelist.clientId}
        htmlFor="rule-whitelist-client"
        hint={canSuggestWhitelistClients ? t.whitelist.clientIdHint : t.whitelist.clientIdHintNoSuggestions}
        error={translateError("clientId")}
      >
        <input
          id="rule-whitelist-client"
          className={fieldStyles.input}
          list={canSuggestWhitelistClients ? CLIENT_SUGGESTIONS_ID : undefined}
          value={values.clientId}
          onChange={(event) => updateValues({ clientId: event.target.value })}
          placeholder="K000024"
          aria-describedby="rule-whitelist-client-hint"
        />
        {canSuggestWhitelistClients && (
          <datalist id={CLIENT_SUGGESTIONS_ID}>
            {SEED_CLIENTS.map((client) => (
              <option key={client.id} value={client.id} />
            ))}
          </datalist>
        )}
      </Field>
      <Field
        label={t.whitelist.reason}
        htmlFor="rule-whitelist-reason"
        hint={t.whitelist.reasonHint}
        error={translateError("reason")}
      >
        <textarea
          id="rule-whitelist-reason"
          className={fieldStyles.textarea}
          value={values.reason}
          onChange={(event) => updateValues({ reason: event.target.value })}
          aria-describedby="rule-whitelist-reason-hint"
        />
      </Field>
      {addMutation.error && <ErrorState error={addMutation.error} />}
      <div>
        <Button type="submit" icon={<Plus aria-hidden="true" />} disabled={addMutation.isPending}>
          {addMutation.isPending ? t.whitelist.adding : t.whitelist.add}
        </Button>
      </div>
    </form>
  );
}

/** Rule-level exceptions (data model M16). Changes apply immediately: no new version, no review. */
export function RuleWhitelistCard({ rule }: { rule: Rule }) {
  const { t } = useI18n();
  const { canManageRules } = useRolePermissions();
  const whitelistQuery = useRuleWhitelist(rule.id, { enabled: rule.whitelistAllowed });
  return (
    <Card
      title={
        <>
          <ShieldOff aria-hidden="true" />
          {t.whitelist.title}
        </>
      }
    >
      <p className={styles.subtitle}>{t.whitelist.subtitle}</p>
      {rule.whitelistAllowed ? (
        <>
          <QueryView query={whitelistQuery}>
            {(entries) => <WhitelistTable ruleId={rule.id} entries={entries} canEdit={canManageRules} />}
          </QueryView>
          {canManageRules && <AddWhitelistEntryForm ruleId={rule.id} />}
        </>
      ) : (
        <Notice tone="info" title={t.whitelist.notAllowedTitle}>
          {t.whitelist.notAllowed}
        </Notice>
      )}
      <Notice tone="compliance">{t.whitelist.complianceWarning}</Notice>
    </Card>
  );
}
