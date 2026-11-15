import type { ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./ui.module.css";

export interface OptionCardProps {
  title: string;
  hint?: string;
  icon?: ReactNode;
  selected?: boolean;
  onSelect: () => void;
  disabled?: boolean;
  role?: "radio" | "checkbox" | "button";
  testId?: string;
}

export const OptionCard = ({
  title,
  hint,
  icon,
  selected = false,
  onSelect,
  disabled = false,
  role = "radio",
  testId,
}: OptionCardProps) => (
  <button
    type="button"
    role={role}
    aria-checked={role === "button" ? undefined : selected}
    aria-pressed={role === "button" ? selected : undefined}
    className={`${styles.optionCard} ${selected ? styles.optionCardSelected : ""}`}
    onClick={onSelect}
    disabled={disabled}
    data-testid={testId}
  >
    {icon ? <span className={styles.optionIcon}>{icon}</span> : null}
    <span className={styles.optionText}>
      <span className={styles.optionTitle}>{title}</span>
      {hint ? <span className={styles.optionHint}>{hint}</span> : null}
    </span>
    <span className={styles.optionCheck} aria-hidden="true">
      {selected ? <Icon name="check" size={16} /> : null}
    </span>
  </button>
);

export interface OptionGroupProps {
  label: string;
  children: ReactNode;
  hint?: string;
}

export const OptionGroup = ({ label, children, hint }: OptionGroupProps) => (
  <div className={styles.optionGroup} role="radiogroup" aria-label={label}>
    {hint ? <p className={styles.fieldHint}>{hint}</p> : null}
    {children}
  </div>
);
