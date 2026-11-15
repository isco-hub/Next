import type { CropCode, SeasonPlan } from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import { Banner } from "./Banner";
import { CropIcon } from "./CropIcon";
import { translatedOr, type Translate } from "./messages";
import styles from "./ui.module.css";

const cropLabel = (t: Translate, crop: CropCode) => t(`common.crop.${crop}`);

export interface SeasonCardProps {
  season: SeasonPlan;
  detailed?: boolean;
}

export const SeasonCard = ({ season, detailed = false }: SeasonCardProps) => {
  const { t, formatDate } = useI18n();
  const rationale = translatedOr(t, season.rationale_key, season.rationale) ?? "";
  const cardClass = [
    styles.seasonCard,
    season.locked ? styles.seasonCardLocked : "",
    season.fallback ? styles.seasonCardFallback : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li>
      <article className={cardClass} aria-labelledby={`season-${season.season_index}-crop`}>
        <div className={styles.seasonHeader}>
          <span className={styles.seasonBadge}>
            {t("plan.seasonLine", {
              season: t(`common.season${season.season}`),
              year: season.year,
            })}
          </span>
          {season.locked ? <span className={styles.chip}>{t("plan.warnings")}</span> : null}
        </div>
        <h3 className={styles.seasonCrop} id={`season-${season.season_index}-crop`}>
          <span className={styles.cropIconWrap}>
            <CropIcon code={season.crop} size={30} label={cropLabel(t, season.crop)} />
          </span>
          <span>{cropLabel(t, season.crop)}</span>
        </h3>
        <p className={styles.window}>
          {t("plan.plantingWindow", {
            start: formatDate(season.window_start, { day: "numeric", month: "short" }),
            end: formatDate(season.window_end, { day: "numeric", month: "short" }),
          })}
        </p>
        <p className={styles.rationale}>{rationale}</p>

        {season.locked ? (
          <div style={{ marginTop: "var(--space-3)" }}>
            <Banner tone="warn">{t("plan.lockedBody")}</Banner>
          </div>
        ) : null}

        {season.fallback ? (
          <div style={{ marginTop: "var(--space-3)" }}>
            <Banner tone="info" title={t("plan.fallbackTitle")}>
              {t("plan.fallbackBody")}
            </Banner>
          </div>
        ) : null}

        <div className={styles.altRow}>
          <span className={styles.altLabel}>{t("plan.alternatives")}</span>
          {season.alternatives.length === 0 ? (
            <span className={styles.chip}>{t("plan.emptyAlternatives")}</span>
          ) : (
            season.alternatives.map((alternative) => (
              <span key={alternative.crop} className={styles.chip}>
                <CropIcon code={alternative.crop} size={16} />
                {cropLabel(t, alternative.crop)}
              </span>
            ))
          )}
        </div>

        {season.warnings.length > 0 ? (
          <ul className={styles.warnings} aria-label={t("plan.warnings")}>
            {season.warnings.map((warning) => (
              <li key={`${warning.code}-${warning.message}`} className={styles.warningItem}>
                <span className={styles.warningMark} aria-hidden="true">
                  !
                </span>
                <span>
                  {translatedOr(t, warning.message_key, warning.message) ?? warning.message}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {season.intercropping ? (
          <p className={styles.intercropping}>
            <strong>{t("plan.intercropping")}:</strong>{" "}
            {t("plan.intercroppingNote", {
              crop: cropLabel(t, season.intercropping.crop),
            })}{" "}
            {translatedOr(
              t,
              season.intercropping.note_key,
              season.intercropping.note,
            )}
          </p>
        ) : null}

        <details className={styles.ruleDetails} open={detailed || undefined}>
          <summary>{t("plan.ruleIds")}</summary>
          <ul className={styles.ruleList}>
            {season.rule_ids.map((ruleId) => (
              <li key={ruleId} className={styles.ruleItem}>
                {ruleId}
              </li>
            ))}
          </ul>
        </details>
      </article>
    </li>
  );
};
