"use client";

import { useId, type ReactNode } from "react";

import { Button, ButtonLink, type ButtonLinkProps, type ButtonProps } from "@/components/ui/Button";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";

import type { RolePermission } from "../permissions";
import styles from "./RoleGatedButton.module.css";
import { useRoleRequirement } from "./useRoleRequirement";

type RoleGate = { permission: RolePermission };

/** A disabled action with the role it needs under it, also as its tooltip and accessible description. */
function DisabledWithRoleHint({
  permission,
  renderButton,
}: RoleGate & { renderButton: (hintId: string) => ReactNode }) {
  const { t } = useI18n();
  const { requiredRoles } = useRoleRequirement(permission);
  const hintId = useId();
  const hint = formatMessage(t.roleGate.requiresShort, { role: requiredRoles });
  return (
    <span className={styles.gatedAction} title={hint}>
      {renderButton(hintId)}
      <span id={hintId} className={styles.hint}>
        {hint}
      </span>
    </span>
  );
}

/** A button the active role may lack the permission for (issue #6): then disabled, naming the role it needs. */
export function RoleGatedButton({ permission, ...buttonProps }: RoleGate & ButtonProps) {
  const { isAllowed } = useRoleRequirement(permission);
  if (isAllowed) {
    return <Button {...buttonProps} />;
  }
  return (
    <DisabledWithRoleHint
      permission={permission}
      renderButton={(hintId) => <Button {...buttonProps} disabled aria-describedby={hintId} />}
    />
  );
}

/** A link styled as a button, gated like RoleGatedButton; a link cannot be disabled, so a disabled button stands in. */
export function RoleGatedButtonLink({ permission, href, ...styleProps }: RoleGate & ButtonLinkProps) {
  const { isAllowed } = useRoleRequirement(permission);
  if (isAllowed) {
    return <ButtonLink href={href} {...styleProps} />;
  }
  return (
    <DisabledWithRoleHint
      permission={permission}
      renderButton={(hintId) => <Button {...styleProps} disabled aria-describedby={hintId} />}
    />
  );
}
