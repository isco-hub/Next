import { useI18n } from "@nextcrop/i18n";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState, Icon, StatCard, StatGrid } from "@nextcrop/ui";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { LoadingPanel, QueryErrorState } from "../components/PageState";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export const FarmerDashboardPage = () => {
  const { t, formatDate } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const plotsQuery = useQuery({
    queryKey: ["plots"],
    queryFn: () => api.listPlots(),
  });
  const plansQuery = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => api.listRecommendations(),
  });

  const plots = plotsQuery.data ?? [];
  const plans = plansQuery.data ?? [];

  return (
    <div className="page container">
      <PageHeader
        eyebrow={t("dashboard.role")}
        title={t("dashboard.farmerTitle")}
        subtitle={t("dashboard.welcome", {
          name: user?.display_name ?? t("auth.roleFarmer"),
        })}
        actions={
          <>
            <Button
              onClick={() => navigate("/wizard")}
              icon={<Icon name="sparkle" size={18} />}
            >
              {t("dashboard.newPlan")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate("/plots")}
              icon={<Icon name="map" size={18} />}
            >
              {t("dashboard.addPlot")}
            </Button>
          </>
        }
      />
      <p className="muted">{t("dashboard.farmerIntro")}</p>

      {plotsQuery.isLoading || plansQuery.isLoading ? (
        <LoadingPanel label={t("common.loading")} />
      ) : null}
      {plotsQuery.isError ? (
        <QueryErrorState
          error={plotsQuery.error}
          onRetry={() => void plotsQuery.refetch()}
        />
      ) : null}
      {plansQuery.isError ? (
        <QueryErrorState
          error={plansQuery.error}
          onRetry={() => void plansQuery.refetch()}
        />
      ) : null}

      <StatGrid>
        <StatCard label={t("dashboard.plots")} value={plots.length} />
        <StatCard label={t("dashboard.plans")} value={plans.length} />
        <StatCard
          label={t("dashboard.crops")}
          value={new Set(plans.flatMap((plan) => plan.crops)).size}
        />
      </StatGrid>

      <section className="panel stack">
        <div>
          <h2>{t("dashboard.quickActions")}</h2>
          <p className="muted small">{t("dashboard.quickActionsIntro")}</p>
        </div>
        <div className="quickGrid">
          <Link className="quickCard" to="/wizard">
            <div className="quickCardIcon"><Icon name="sparkle" size={20} /></div>
            <h3>{t("dashboard.newPlan")}</h3>
            <p className="muted small">{t("dashboard.newPlanIntro")}</p>
          </Link>
          <Link className="quickCard" to="/plots">
            <div className="quickCardIcon"><Icon name="map" size={20} /></div>
            <h3>{t("dashboard.addPlot")}</h3>
            <p className="muted small">{t("dashboard.addPlotIntro")}</p>
          </Link>
          <Link className="quickCard" to="/climate">
            <div className="quickCardIcon"><Icon name="rain" size={20} /></div>
            <h3>{t("dashboard.checkClimate")}</h3>
            <p className="muted small">{t("dashboard.checkClimateIntro")}</p>
          </Link>
        </div>
      </section>

      {plots.length === 0 ? (
        <EmptyState
          icon="map"
          title={t("dashboard.noPlots")}
          action={
            <Button onClick={() => navigate("/plots")}>
              {t("dashboard.addPlot")}
            </Button>
          }
        />
      ) : null}

      {plans.length > 0 ? (
        <section className="panel stack">
          <h2>{t("dashboard.recentPlans")}</h2>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t("common.date")}</th>
                <th scope="col">{t("dashboard.crops")}</th>
                <th scope="col">{t("dashboard.season")}</th>
              </tr>
            </thead>
            <tbody>
              {plans.slice(0, 5).map((plan) => (
                <tr key={plan.id}>
                  <td>{formatDate(plan.created_at)}</td>
                  <td>{plan.crops.map((crop) => t(`common.crop.${crop}`)).join(", ")}</td>
                  <td>{plan.season}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link className="pill" to="/plan">
            {t("dashboard.viewPlans")}
          </Link>
        </section>
      ) : null}
    </div>
  );
};
