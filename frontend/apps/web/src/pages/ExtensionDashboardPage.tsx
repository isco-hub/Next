import { useMemo } from "react";
import { DISTRICTS, findSubcounty, type Subcounty } from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Button, Icon, StatCard, StatGrid } from "@nextcrop/ui";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { LoadingPanel, QueryErrorState } from "../components/PageState";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export const ExtensionDashboardPage = () => {
  const { t, formatNumber } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();

  const areas = useMemo<Subcounty[]>(() => {
    const assigned = (user?.subcounty_ids ?? [])
      .map((id) => findSubcounty(id))
      .filter((entry): entry is Subcounty => Boolean(entry));
    if (assigned.length > 0) return assigned;
    return user?.role === "admin" ? [...(DISTRICTS[0]?.subcounties ?? [])] : [];
  }, [user]);

  const summaryQueries = useQueries({
    queries: areas.map((area) => ({
      queryKey: ["extensionArea", area.id],
      queryFn: () => api.getOfficerSummary(area.id),
    })),
  });

  const observationsQuery = useQuery({
    queryKey: ["observations", user?.id],
    queryFn: () => api.listObservations(),
  });
  const reportsQuery = useQuery({
    queryKey: ["extensionReports"],
    queryFn: () => api.getReports(),
  });

  const summaries = summaryQueries
    .map((query) => query.data)
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const farmers = summaries.reduce((total, entry) => total + entry.farmers_count, 0);
  const observations = observationsQuery.data ?? [];
  const plans =
    reportsQuery.data?.usage_by_channel.reduce((total, entry) => total + entry.count, 0) ?? 0;
  const loading =
    summaryQueries.some((query) => query.isLoading) ||
    observationsQuery.isLoading ||
    reportsQuery.isLoading;
  const error =
    summaryQueries.find((query) => query.isError)?.error ??
    observationsQuery.error ??
    reportsQuery.error;

  return (
    <div className="page container">
      <PageHeader
        eyebrow={t("dashboard.extensionScope")}
        title={t("dashboard.extensionTitle")}
        subtitle={t("dashboard.extensionIntro", {
          name: user?.display_name ?? t("auth.roleOfficer"),
        })}
        actions={
          <>
            <Button onClick={() => navigate("/officer")} icon={<Icon name="users" size={18} />}>
              {t("dashboard.openFieldWorkspace")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate("/reports")}
              icon={<Icon name="chart" size={18} />}
            >
              {t("dashboard.reports")}
            </Button>
          </>
        }
      />

      {loading ? <LoadingPanel label={t("common.loading")} /> : null}
      {error ? (
        <QueryErrorState
          error={error}
          onRetry={() => {
            summaryQueries.forEach((query) => void query.refetch());
            void observationsQuery.refetch();
            void reportsQuery.refetch();
          }}
        />
      ) : null}

      <StatGrid>
        <StatCard label={t("dashboard.assignedAreas")} value={formatNumber(areas.length)} />
        <StatCard label={t("dashboard.farmers")} value={formatNumber(farmers)} />
        <StatCard label={t("dashboard.observations")} value={formatNumber(observations.length)} />
        <StatCard label={t("dashboard.plans")} value={formatNumber(plans)} />
      </StatGrid>

      <section className="panel stack">
        <div className="row-between">
          <div>
            <h2>{t("dashboard.areaOverview")}</h2>
            <p className="muted small">{t("dashboard.areaOverviewIntro")}</p>
          </div>
          <Link className="pill" to="/officer">
            {t("dashboard.openFieldWorkspace")}
          </Link>
        </div>

        {areas.length === 0 ? (
          <div className="emptyPanel">
            <Icon name="map" size={28} />
            <h3>{t("dashboard.noAssignedAreas")}</h3>
            <p className="muted">{t("dashboard.noAssignedAreasBody")}</p>
          </div>
        ) : (
          <div className="quickGrid">
            {areas.map((area, index) => {
              const summary = summaryQueries[index]?.data;
              return (
                <article key={area.id} className="quickCard">
                  <div className="quickCardIcon">
                    <Icon name="map" size={20} />
                  </div>
                  <div>
                    <h3>{area.name}</h3>
                    <p className="muted small">{t(`common.district.${area.district_id}`)}</p>
                  </div>
                  {summary ? (
                    <dl className="miniStats">
                      <div>
                        <dt>{t("dashboard.farmers")}</dt>
                        <dd>{formatNumber(summary.farmers_count)}</dd>
                      </div>
                      <div>
                        <dt>{t("officer.moisture")}</dt>
                        <dd>{t(`common.moisture.${summary.moisture_class}`)}</dd>
                      </div>
                      <div>
                        <dt>{t("officer.onset")}</dt>
                        <dd>
                          {{
                            not_started: t("climate.onsetNotStarted"),
                            onset_detected: t("climate.onsetDetected"),
                            false_start_risk: t("climate.onsetFalseStart"),
                            unknown: t("climate.onsetUnknown"),
                          }[summary.onset_status]}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="muted small">{t("dashboard.noData")}</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel stack">
        <div className="row-between">
          <div>
            <h2>{t("dashboard.fieldWorkspace")}</h2>
            <p className="muted small">{t("dashboard.fieldWorkspaceIntro")}</p>
          </div>
          <Link className="pill" to="/reports">
            {t("dashboard.reports")}
          </Link>
        </div>
        <div className="quickGrid">
          <Link className="quickCard" to="/officer">
            <div className="quickCardIcon"><Icon name="users" size={20} /></div>
            <h3>{t("dashboard.registerFarmer")}</h3>
            <p className="muted small">{t("dashboard.registerFarmerIntro")}</p>
          </Link>
          <Link className="quickCard" to="/officer">
            <div className="quickCardIcon"><Icon name="file" size={20} /></div>
            <h3>{t("dashboard.captureObservation")}</h3>
            <p className="muted small">{t("dashboard.captureObservationIntro")}</p>
          </Link>
          <Link className="quickCard" to="/officer">
            <div className="quickCardIcon"><Icon name="phone" size={20} /></div>
            <h3>{t("dashboard.sendAdvice")}</h3>
            <p className="muted small">{t("dashboard.sendAdviceIntro")}</p>
          </Link>
        </div>
      </section>
    </div>
  );
};
