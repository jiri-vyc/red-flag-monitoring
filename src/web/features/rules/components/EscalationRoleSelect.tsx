"use client";

import { Field, fieldStyles } from "@/components/ui/Field";
import { USER_ROLES, type UserRole } from "@/features/users/types";
import { useI18n } from "@/i18n/I18nProvider";

type EscalationRoleSelectProps = {
  id: string;
  value: UserRole;
  onChange: (role: UserRole) => void;
};

/** Picks who handles the hits of the reviewed version (issue #6); the review sends it with the decision. */
export function EscalationRoleSelect({ id, value, onChange }: EscalationRoleSelectProps) {
  const { t } = useI18n();
  return (
    <Field label={t.rules.escalationRole} htmlFor={id} hint={t.rules.escalationRoleHint}>
      <select
        id={id}
        className={fieldStyles.select}
        value={value}
        onChange={(event) => onChange(event.target.value as UserRole)}
      >
        {USER_ROLES.map((role) => (
          <option key={role} value={role}>
            {t.roles[role]}
          </option>
        ))}
      </select>
    </Field>
  );
}
