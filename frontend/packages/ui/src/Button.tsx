import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./ui.module.css";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "dangerGhost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "default" | "large" | "small";
  fullWidth?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
}

export const Button = ({
  variant = "primary",
  size = "default",
  fullWidth = false,
  loading = false,
  loadingLabel,
  icon,
  children,
  disabled,
  className = "",
  type = "button",
  ...props
}: ButtonProps) => {
  const classes = [
    styles.button,
    styles[variant],
    size === "large" ? styles.large : size === "small" ? styles.small : "",
    fullWidth ? styles.fullWidth : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {!loading && icon ? <span className={styles.buttonIcon}>{icon}</span> : null}
      <span>{loading ? (loadingLabel ?? children) : children}</span>
    </button>
  );
};

