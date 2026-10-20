import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "md" | "lg";

type StyleProps = { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode };

function buildClassName({ variant = "primary", size = "md" }: StyleProps, extraClassName?: string): string {
  return [styles.button, styles[variant], styles[size], extraClassName].filter(Boolean).join(" ");
}

export type ButtonProps = StyleProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant,
  size,
  icon,
  className,
  children,
  type = "button",
  ...buttonProps
}: ButtonProps) {
  return (
    <button type={type} className={buildClassName({ variant, size }, className)} {...buttonProps}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

export type ButtonLinkProps = StyleProps & { href: string; children: ReactNode; className?: string };

export function ButtonLink({ variant, size, icon, href, className, children }: ButtonLinkProps) {
  return (
    <Link href={href} className={buildClassName({ variant, size }, className)}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}
