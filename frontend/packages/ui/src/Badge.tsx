import type { ReactNode } from "react";
import type { Confidence } from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import styles from "./ui.module.css";

export type BadgeTone = "neutral" | "info" | "warn" | "danger" | "success";

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
}

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: styles.badgeNeutral ?? "",
  info: styles.badgeInfo ?? "",
  warn: styles.badgeWarn ?? "",
  danger: styles.badgeDanger ?? "",
  success: styles.badgeSuccess ?? "",
};

export const Badge = ({ children, tone = "neutral", icon }: BadgeProps) => (
  <span className={`${styles.badge} ${TONE_CLASS[tone]}`}>
    {icon}
    {children}
  </span>
);

export interface ConfidenceBadgeProps {
  confidence: Confidence;
  showHint?: boolean;
}

const LEVELS: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };

const CONFIDENCE_CLASS: Record<Confidence, string> = {
  low: styles.confidenceLow ?? "",
  medium: styles.confidenceMedium ?? "",
  high: styles.confidenceHigh ?? "",
};

export const ConfidenceBadge = ({
  confidence,
  showHint = false,
}: ConfidenceBadgeProps) => {
  const { t } = useI18n();
  const bars = LEVELS[confidence];
  const hint = t(`confidence.${confidence}Hint`);
  return (
    <span className={`${styles.confidence} ${CONFIDENCE_CLASS[confidence]}`} title={hint}>
      <span className={styles.confidenceBars} aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span key={index} className={styles.confidenceBar} data-active={index < bars} />
        ))}
      </span>
      <span>{t(`confidence.${confidence}`)}</span>
      {showHint ? <span className={styles.srOnly}>{hint}</span> : null}
    </span>
  );
};

