import type { ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./ui.module.css";

export interface ToastProps {
  tone?: "info" | "success" | "error";
  children: ReactNode;
}

export const Toast = ({ tone = "info", children }: ToastProps) => (
  <div
    className={`${styles.toast} ${tone === "success" ? styles.toastSuccess : ""} ${
      tone === "error" ? styles.toastError : ""
    }`}
  >
    <Icon
      name={tone === "success" ? "check" : tone === "error" ? "alert" : "info"}
      size={18}
    />
    <span>{children}</span>
  </div>
);

export const ToastRegion = ({ children }: { children: ReactNode }) => (
  <div className={styles.toastRegion} role="status" aria-live="polite">
    {children}
  </div>
);

