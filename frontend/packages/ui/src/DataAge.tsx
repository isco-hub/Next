import { useI18n } from "@nextcrop/i18n";
import styles from "./ui.module.css";

export interface DataAgeProps {
  hours: number;
  offline?: boolean;
  staleAfterHours?: number;
}

export const formatAge = (
  hours: number,
  t: (key: string, values?: Record<string, string | number>) => string,
): string => {
  const minutes = Math.max(0, Math.round(hours * 60));
  if (minutes < 2) return t("common.justNow");
  if (minutes < 60) return t("common.minutesAgo", { count: minutes });
  if (hours < 48) return t("common.hoursAgo", { count: Math.round(hours) });
  return t("common.daysAgo", { count: Math.round(hours / 24) });
};

export const DataAge = ({
  hours,
  offline = false,
  staleAfterHours = 48,
}: DataAgeProps) => {
  const { t } = useI18n();
  const relative = formatAge(hours, t);
  const stale = hours >= staleAfterHours;
  const key = offline ? "dataAge.offline" : stale ? "dataAge.stale" : "dataAge.fresh";
  return (
    <span className={`${styles.dataAge} ${stale ? styles.dataAgeStale : ""}`}>
      <span className={styles.clock} aria-hidden="true" />
      <span>{t(key, { time: relative })}</span>
    </span>
  );
};
