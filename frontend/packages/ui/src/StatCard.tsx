import type { ReactNode } from "react";
import styles from "./ui.module.css";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
}

export const StatCard = ({ label, value, hint }: StatCardProps) => (
  <div className={styles.statCard}>
    <p className={styles.statLabel}>{label}</p>
    <p className={styles.statValue}>{value}</p>
    {hint ? <p className={styles.statHint}>{hint}</p> : null}
  </div>
);

export const StatGrid = ({ children }: { children: ReactNode }) => (
  <div className={styles.statGrid}>{children}</div>
);

