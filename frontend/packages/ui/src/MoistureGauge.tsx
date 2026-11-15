import type { MoistureClass } from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import styles from "./ui.module.css";

const POSITION: Record<MoistureClass, string> = {
  dry: "16%",
  normal: "50%",
  wet: "84%",
};

export interface MoistureGaugeProps {
  moisture: MoistureClass;
}

export const MoistureGauge = ({ moisture }: MoistureGaugeProps) => {
  const { t } = useI18n();
  const label = t(`common.moisture.${moisture}`);
  return (
    <div
      className={styles.gauge}
      role="img"
      aria-label={t("climate.gaugeAria", { class: label })}
    >
      <span className={styles.gaugeValue}>{label}</span>
      <div className={styles.gaugeTrack}>
        <span className={styles.gaugeZoneDry} />
        <span className={styles.gaugeZoneNormal} />
        <span className={styles.gaugeZoneWet} />
        <span className={styles.gaugeMarker} style={{ left: POSITION[moisture] }} />
      </div>
      <div className={styles.gaugeLabels} aria-hidden="true">
        <span>{t("common.moisture.dry")}</span>
        <span>{t("common.moisture.normal")}</span>
        <span>{t("common.moisture.wet")}</span>
      </div>
    </div>
  );
};

