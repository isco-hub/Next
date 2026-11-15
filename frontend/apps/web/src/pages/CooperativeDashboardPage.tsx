import { useI18n } from "@nextcrop/i18n";
import { useQuery } from "@tanstack/react-query";
import { Button, Icon, StatCard, StatGrid } from "@nextcrop/ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { LoadingPanel, QueryErrorState } from "../components/PageState";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export const CooperativeDashboardPage = () => {
  const { t, formatNumber } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const summaryQuery = useQuery({
    queryKey: ["cooperativeSummary", user?.subcounty_ids],
    queryFn: () =>
      api.getOfficerSummary(user?.subcounty_ids?.[0] || undefined),
  });
  const reportsQuery = useQuery({
    queryKey: ["cooperativeReports"],
    queryFn: () => api.getReports(),
  });

  return (
    <div className="page container">
      <PageHeader
        eyebrow={t("auth.roleCooperative")}
        title={t("dashboard.cooperativeTitle")}
        subtitle={t("dashboard.cooperativeIntro")}
        actions={
          <>
            <Button
              onClick={() => navigate("/officer")}
              icon={<Icon name="users" size={18} />}
            >
              {t("dashboard.farmers")}
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

      {summaryQuery.isLoading || reportsQuery.isLoading ? (
        <LoadingPanel label={t("common.loading")} />
      ) : null}
      {summaryQuery.isError ? (
        <QueryErrorState
          error={summaryQuery.error}
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : null}
      {reportsQuery.isError ? (
        <QueryErrorState
          error={reportsQuery.error}
          onRetry={() => void reportsQuery.refetch()}
        />
      ) : null}

      <StatGrid>
        <StatCard
          label={t("dashboard.farmers")}
          value={formatNumber(summaryQuery.data?.farmers_count ?? 0)}
          hint={summaryQuery.data?.subcounty_name}
        />
        <StatCard
          label={t("dashboard.plans")}
          value={formatNumber(
            reportsQuery.data?.usage_by_channel.reduce(
              (total, entry) => total + entry.count,
              0,
            ) ?? 0,
          )}
        />
        <StatCard
          label={t("dashboard.observations")}
          value={formatNumber(
            reportsQuery.data?.adoption_funnel.at(-1)?.count ?? 0,
          )}
        />
      </StatGrid>
    </div>
  );
};
