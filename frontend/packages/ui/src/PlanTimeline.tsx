import type { Recommendation } from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import type { ReactNode } from "react";
import { Badge } from "./Badge";
import { ConfidenceBadge } from "./Badge";
import { DataAge } from "./DataAge";
import { Disclaimer } from "./Disclaimer";
import { SeasonCard } from "./SeasonCard";
import styles from "./ui.module.css";

export interface PlanTimelineProps {
  recommendation: Recommendation;
  detailed?: boolean;
  sampleMode?: boolean;
  cachedAt?: string | null;
  locationLabel?: string;
  actions?: ReactNode;
}

export const PlanTimeline = ({
  recommendation,
  detailed = false,
  sampleMode = false,
  cachedAt = null,
  locationLabel,
  actions,
}: PlanTimelineProps) => {
  const { t, formatDateTime } = useI18n();
  const ruleIds = [...new Set(recommendation.seasons.flatMap((season) => season.rule_ids))];

  return (
    <section className={styles.planTimeline} aria-labelledby="plan-title">
      <header className={styles.planHeader}>
        <div>
          <h1 className={styles.planTitle} id="plan-title">
            {t("plan.title")}
          </h1>
          <p className={styles.muted}>
            {t("plan.subtitle", { count: recommendation.seasons.length })}
          </p>
          {locationLabel ? (
            <p className={styles.muted}>{t("plan.planFor", { place: locationLabel })}</p>
          ) : null}
        </div>
        <div className={styles.planMeta}>
          {sampleMode ? <Badge tone="warn">{t("common.sampleData")}</Badge> : null}
          <Badge tone="neutral">{t("plan.packVersion", { version: recommendation.pack_version })}</Badge>
        </div>
      </header>

      {cachedAt ? (
        <div className={styles.planMeta}>
          <Badge tone="info">{t("plan.cachedPlan")}</Badge>
          <span>{t("plan.cachedAt", { time: formatDateTime(cachedAt) })}</span>
        </div>
      ) : null}

      <div className={styles.planMeta}>
        <span>{t("plan.generatedOn", { date: formatDateTime(recommendation.created_at) })}</span>
        <DataAge hours={recommendation.outlook.data_age_hours} offline={Boolean(cachedAt)} />
        <ConfidenceBadge confidence={recommendation.outlook.confidence} showHint />
      </div>

      <ol className={styles.planSeasons}>
        {recommendation.seasons.map((season) => (
          <SeasonCard key={season.season_index} season={season} detailed={detailed} />
        ))}
      </ol>

      <Disclaimer />

      <div className={styles.planMeta}>
        <span>{t("plan.packVersion", { version: recommendation.pack_version })}</span>
        <details className={styles.ruleDetails}>
          <summary>{t("plan.ruleIds")}</summary>
          <ul className={styles.ruleList}>
            {ruleIds.map((ruleId) => (
              <li key={ruleId} className={styles.ruleItem}>
                {ruleId}
              </li>
            ))}
          </ul>
        </details>
      </div>

      {actions ? <div className={styles.row}>{actions}</div> : null}
    </section>
  );
};

