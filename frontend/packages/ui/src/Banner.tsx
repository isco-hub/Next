import type { ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./ui.module.css";

export type BannerTone = "info" | "warn" | "error" | "success";

export interface BannerProps {
  tone?: BannerTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  live?: "polite" | "assertive" | "off";
}

const toneIcon = {
  info: "info",
  warn: "warning",
  error: "alert",
  success: "check",
} as const;

export const Banner = ({
  tone = "info",
  title,
  children,
  action,
  icon,
  live = "off",
}: BannerProps) => (
  <div
    className={`${styles.banner} ${styles[tone]}`}
    role={tone === "error" ? "alert" : undefined}
    aria-live={live === "off" ? undefined : live}
  >
    <span className={styles.bannerIcon} aria-hidden="true">
      {icon ?? <Icon name={toneIcon[tone]} size={16} />}
    </span>
    <div className={styles.bannerBody}>
      {title ? <p className={styles.bannerTitle}>{title}</p> : null}
      {children ? <div className={styles.bannerText}>{children}</div> : null}
      {action ? <div className={styles.bannerAction}>{action}</div> : null}
    </div>
  </div>
);
