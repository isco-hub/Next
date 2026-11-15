import { useMemo, useState } from "react";
import { resolveLocation } from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Banner,
  Button,
  DataAge,
  DataLimits,
  Icon,
  MoistureGauge,
  RainfallChart,
  StatCard,
  StatGrid,
} from "@nextcrop/ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { LoadingPanel, QueryErrorState } from "../components/PageState";
import { api, demoMode } from "../lib/api";
import { readLastPlan } from "../lib/cache";
import { readLocationDraft } from "../lib/draft";
import { useOnline } from "../lib/online";

export const ClimatePage = () => {
  const { t, formatNumber, formatDate } = useI18n();
  const navigate = useNavigate();
  const online = useOnline();
  const [draft] = useState(readLocationDraft);
  const [cached] = useState(readLastPlan);

  const resolved = useMemo(
    () =>
      draft
        ? resolveLocation({
            lat: draft.lat,
            lon: draft.lon,
            district_id: draft.district_id,
            subcounty_id: draft.subcounty_id,
          })
        : null,
    [draft],
  );

  const query = useQuery({
    queryKey: ["outlook", draft?.lat, draft?.lon, draft?.district_id, draft?.subcounty_id],
    queryFn: () =>
      api.getOutlook({
        lat: draft?.lat,
        lon: draft?.lon,
        district_id: draft?.district_id,
        subcounty_id: draft?.subcounty_id,
      }),
    enabled: Boolean(draft),
    staleTime: 5 * 60 * 1000,
  });

  const outlook =
    query.data ??
    (query.isError || !online ? cached?.recommendation.outlook : undefined);

  if (!draft || !resolved) {
    return (
      <div className="page container">
        <PageHeader title={t("climate.title")} subtitle={t("climate.subtitle")} />
        <div className="panel stack">
          <Banner tone="info">{t("location.requiredTitle")}</Banner>
          <Button onClick={() => navigate("/location")}>
            {t("location.title")}
          </Button>
        </div>
      </div>
    );
  }

  if (query.isLoading && !outlook) {
    return (
      <div className="page container">
        <PageHeader
          eyebrow={resolved.subcounty.name}
          title={t("climate.title")}
          subtitle={t("climate.subtitle")}
        />
        <LoadingPanel label={t("common.loading")} />
      </div>
    );
  }

  if (!outlook) {
    return (
      <div className="page container">
        <PageHeader
          eyebrow={resolved.subcounty.name}
          title={t("climate.title")}
          subtitle={t("climate.subtitle")}
        />
        <div className="panel stack">
          <Banner tone="warn" title={t("climate.noDataTitle")}>
            {t("climate.noDataBody")}
          </Banner>
          <Button onClick={() => navigate("/location")} icon={<Icon name="arrow-left" size={18} />}>
            {t("location.changeLocation")}
          </Button>
        </div>
      </div>
    );
  }

  const moistureKey = `climate.moisture${outlook.moisture_class
    .charAt(0)
    .toUpperCase()}${outlook.moisture_class.slice(1)}` as
    | "climate.moistureDry"
    | "climate.moistureNormal"
    | "climate.moistureWet";

  const onsetKey = {
    not_started: "climate.onsetNotStarted",
    onset_detected: "climate.onsetDetected",
    false_start_risk: "climate.onsetFalseStart",
    unknown: "climate.onsetUnknown",
  }[outlook.onset_status];

  const noRecent = outlook.notice_code === "no_recent_data";
  const stale = outlook.notice_code === "stale_data";
  const usingFallback = Boolean(query.isError || !online);

  return (
    <div className="page container">
      <PageHeader
        eyebrow={`${resolved.subcounty.name}, ${resolved.district.name}`}
        title={t("climate.title")}
        subtitle={t("climate.subtitle")}
        actions={
          <>
            <Badge tone={demoMode ? "warn" : "success"}>
              {demoMode ? t("common.sampleData") : t("common.liveData")}
            </Badge>
            <DataAge hours={outlook.data_age_hours} offline={!online} />
          </>
        }
      />

      {usingFallback && cached ? (
        <Banner tone="info">{t("climate.offlineCached", {
          time: formatDate(cached.cachedAt),
        })}</Banner>
      ) : null}

      {noRecent ? (
        <Banner tone="warn" title={t("climate.noDataTitle")}>
          {t("climate.noDataBody")}
        </Banner>
      ) : null}
      {stale ? (
        <Banner tone="warn" title={t("climate.staleTitle")}>
          {t("climate.staleBody", { hours: Math.round(outlook.data_age_hours) })}
        </Banner>
      ) : null}

      <Banner tone="info" title={t("climate.bannerTitle")}>
        {t("climate.bannerBody")}
      </Banner>

      <StatGrid>
        <StatCard
          label={t("climate.rainfall30")}
          value={t("climate.total", {
            value: formatNumber(outlook.rainfall_actual_total, {
              maximumFractionDigits: 1,
            }),
          })}
          hint={t("climate.normalTotal", {
            value: formatNumber(outlook.rainfall_normal_total, {
              maximumFractionDigits: 1,
            }),
          })}
        />
        <StatCard
          label={t("climate.moisture")}
          value={t(moistureKey)}
          hint={t("climate.moistureHint")}
        />
        <StatCard
          label={t("climate.seasonStatus")}
          value={t(onsetKey)}
          hint={t("climate.thisSeason", {
            season: t(`common.season${outlook.season}`),
          })}
        />
        <StatCard
          label={t("climate.drySpellDays")}
          value={t("climate.drySpellDaysValue", { count: outlook.dry_spell_days })}
          hint={t("climate.drySpellsCountValue", {
            count: outlook.dry_spells_count,
          })}
        />
      </StatGrid>

      <div className="grid2">
        <section className="panel stack">
          <div>
            <h2>{t("climate.rainfall30")}</h2>
            <p className="muted small">
              {t("climate.chartSummary", {
                actual: formatNumber(outlook.rainfall_actual_total, {
                  maximumFractionDigits: 1,
                }),
                normal: formatNumber(outlook.rainfall_normal_total, {
                  maximumFractionDigits: 1,
                }),
              })}
            </p>
          </div>
          <RainfallChart
            points={outlook.rainfall_30d}
            actualTotal={outlook.rainfall_actual_total}
            normalTotal={outlook.rainfall_normal_total}
          />
        </section>

        <section className="panel stack">
          <h2>{t("climate.moisture")}</h2>
          <MoistureGauge moisture={outlook.moisture_class} />
          <p className="muted small">{t("climate.moistureHint")}</p>
          <div>
            <p className="eyebrow">{t("climate.onset")}</p>
            <p style={{ marginBottom: 0 }}>{t(onsetKey)}</p>
          </div>
        </section>
      </div>

      {outlook.seasonal_outlook ? (
        <section className="panel stack">
          <div className="row-between">
            <div>
              <h2>{t("climate.seasonalOutlook")}</h2>
              <p className="muted small">
                {outlook.seasonal_outlook.label} ·{" "}
                {formatDate(outlook.seasonal_outlook.issued_at)}
              </p>
            </div>
            <Badge tone={outlook.seasonal_outlook.is_nasa ? "success" : "neutral"}>
              {outlook.seasonal_outlook.is_nasa
                ? t("climate.sourcePower")
                : t("climate.externalSource")}
            </Badge>
          </div>
          <p style={{ marginBottom: 0 }}>{outlook.seasonal_outlook.text}</p>
        </section>
      ) : null}

      <section className="panel stack">
        <div className="row-between">
          <h2 style={{ marginBottom: 0 }}>{t("climate.sources")}</h2>
          <div className="row">
            {outlook.data_sources.map((source) => (
              <span key={source} className="pill">
                {source}
              </span>
            ))}
          </div>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          {t("notices.regionalGuidance")}
        </p>
        <DataLimits />
      </section>

      <div className="row">
        <Button
          variant="secondary"
          onClick={() => navigate("/location")}
          icon={<Icon name="arrow-left" size={18} />}
        >
          {t("location.changeLocation")}
        </Button>
        <Button
          onClick={() => navigate("/wizard")}
          icon={<Icon name="arrow-right" size={18} />}
        >
          {t("climate.continueToForm")}
        </Button>
      </div>
    </div>
  );
};
