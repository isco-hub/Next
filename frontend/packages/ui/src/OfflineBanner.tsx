import { useI18n } from "@nextcrop/i18n";
import { Icon } from "./Icon";
import styles from "./ui.module.css";

export interface OfflineBannerProps {
  offline: boolean;
  pendingCount?: number;
}

export const OfflineBanner = ({ offline, pendingCount = 0 }: OfflineBannerProps) => {
  const { t } = useI18n();
  if (!offline) return null;
  return (
    <div className={styles.offlineBanner} role="status" aria-live="polite">
      <Icon name="wifi-off" size={18} />
      <span>{t("common.offline")}</span>
      {pendingCount > 0 ? (
        <span>
          · {t("wizard.queuedAttempts", { count: pendingCount })}
        </span>
      ) : null}
    </div>
  );
};
