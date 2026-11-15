import { useI18n } from "@nextcrop/i18n";
import styles from "./ui.module.css";

export const DataLimits = () => {
  const { t } = useI18n();
  return (
    <details className={styles.ruleDetails}>
      <summary>{t("climate.dataLimits")}</summary>
      <p className={styles.muted}>{t("climate.dataLimitsBody")}</p>
    </details>
  );
};
