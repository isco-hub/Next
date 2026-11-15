import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./ui.module.css";

export interface EmptyStateProps {
  title: string;
  body?: string;
  icon?: IconName;
  action?: ReactNode;
}

export const EmptyState = ({ title, body, icon = "leaf", action }: EmptyStateProps) => (
  <div className={styles.emptyState}>
    <span className={styles.emptyIcon} aria-hidden="true">
      <Icon name={icon} size={28} />
    </span>
    <h2 className={styles.emptyTitle}>{title}</h2>
    {body ? <p className={styles.emptyBody}>{body}</p> : null}
    {action}
  </div>
);
