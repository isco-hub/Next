import { useI18n } from "@nextcrop/i18n";
import { Icon } from "./Icon";
import styles from "./ui.module.css";

export const Disclaimer = () => {
  const { t } = useI18n();
  return (
    <aside className={styles.disclaimer} aria-label={t("plan.disclaimerTitle")}>
      <Icon name="shield" size={22} />
      <div>
        <p className={styles.disclaimerTitle}>{t("plan.disclaimerTitle")}</p>
        <p className={styles.disclaimerBody}>{t("plan.disclaimerBody")}</p>
      </div>
    </aside>
  );
};
