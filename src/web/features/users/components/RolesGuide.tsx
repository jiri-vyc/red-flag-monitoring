"use client";

import { Badge } from "@/components/ui/Badge";
import { formatMessage } from "@/i18n/dictionaries";
import { useI18n } from "@/i18n/I18nProvider";

import { grantedPermissions } from "../permissions";
import { DEFAULT_ESCALATION_ROLE, USER_ROLES, type UserRole } from "../types";
import styles from "./RolesGuide.module.css";

function RoleSection({ role, isActive }: { role: UserRole; isActive: boolean }) {
  const { t } = useI18n();
  const legalBases: Partial<Record<UserRole, string>> = t.rolesGuide.legalBasis;
  const legalBasis = legalBases[role];
  const permissions = grantedPermissions(role);
  return (
    <li className={isActive ? `${styles.role} ${styles.activeRole}` : styles.role}>
      <h3 className={styles.roleHeading}>
        <span className={styles.roleName}>{t.roles[role]}</span>
        {isActive && <Badge tone="success">{t.rolesGuide.active}</Badge>}
      </h3>
      {legalBasis && (
        <p className={styles.detail}>
          <span className={styles.label}>{t.rolesGuide.legalBasisLabel}:</span> {legalBasis}
        </p>
      )}
      <div className={styles.detail}>
        <span className={styles.label}>{t.rolesGuide.canDoLabel}:</span>
        {permissions.length > 0 ? (
          <ul className={styles.permissions}>
            {permissions.map((permission) => (
              <li key={permission}>{t.rolesGuide.permissions[permission]}</li>
            ))}
          </ul>
        ) : (
          ` ${t.rolesGuide.readOnly}`
        )}
      </div>
      <p className={styles.detail}>
        <span className={styles.label}>{t.rolesGuide.escalationLabel}:</span>{" "}
        {role === DEFAULT_ESCALATION_ROLE ? t.rolesGuide.defaultEscalationHits : t.rolesGuide.escalationHits}
      </p>
    </li>
  );
}

/** Issue #6: what each role may do (derived from the permissions) and what is escalated to it. */
export function RolesGuide({ activeRole }: { activeRole: UserRole }) {
  const { t } = useI18n();
  return (
    <div className={styles.guide}>
      <h2 className={styles.title}>{t.rolesGuide.title}</h2>
      <ul className={styles.roles}>
        {USER_ROLES.map((role) => (
          <RoleSection key={role} role={role} isActive={role === activeRole} />
        ))}
      </ul>
      <section className={styles.escalation}>
        <h3 className={styles.sectionHeading}>{t.rolesGuide.escalationTitle}</h3>
        <p>{formatMessage(t.rolesGuide.escalationBody, { role: t.roles[DEFAULT_ESCALATION_ROLE] })}</p>
      </section>
    </div>
  );
}
