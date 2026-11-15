import type { ReactNode } from "react";
import styles from "./ui.module.css";

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  requiredLabel?: string;
  children: ReactNode;
  errorId?: string;
}

export const Field = ({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  children,
  errorId,
}: FieldProps) => (
  <div className={styles.field}>
    <label className={styles.fieldLabel} htmlFor={htmlFor}>
      {label}
      {required ? (
        <span className={styles.required} aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
    {hint ? <p className={styles.fieldHint}>{hint}</p> : null}
    {children}
    {error ? (
      <p className={styles.fieldError} id={errorId} role="alert">
        {error}
      </p>
    ) : null}
  </div>
);

export const inputClass = (hasError: boolean, extra = "") =>
  `${styles.input} ${hasError ? styles.inputError : ""} ${extra}`.trim();

export const selectClass = (hasError: boolean, extra = "") =>
  `${styles.select} ${hasError ? styles.inputError : ""} ${extra}`.trim();

export const textareaClass = (hasError: boolean, extra = "") =>
  `${styles.textarea} ${hasError ? styles.inputError : ""} ${extra}`.trim();
