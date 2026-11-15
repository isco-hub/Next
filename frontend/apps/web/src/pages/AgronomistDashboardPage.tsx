import { useI18n } from "@nextcrop/i18n";
import { useQuery } from "@tanstack/react-query";
import { Button, Icon, StatCard, StatGrid } from "@nextcrop/ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { LoadingPanel, QueryErrorState } from "../components/PageState";
import { api } from "../lib/api";

export const AgronomistDashboardPage = () => {
  const { t, formatNumber } = useI18n();
  const navigate = useNavigate();
  const reportsQuery = useQuery({
    queryKey: ["agronomistReports"],
    queryFn: () => api.getReports(),
  });
  const packsQuery = useQuery({
    queryKey: ["agronomistRulePacks"],
    queryFn: () => api.listRulePacks(),
  });

  const packs = packsQuery.data ?? [];
  const report = reportsQuery.data;

  return (
    <div className="page container">
      <PageHeader
        eyebrow={t("auth.roleAgronomist")}
        title={t("dashboard.agronomistTitle")}
        subtitle={t("dashboard.agronomistIntro")}
        actions={
          <>
            <Button
              onClick={() => navigate("/admin")}
              icon={<Icon name="shield" size={18} />}
            >
              {t("dashboard.manageRulePacks")}
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

      {reportsQuery.isLoading || packsQuery.isLoading ? (
        <LoadingPanel label={t("common.loading")} />
      ) : null}
      {reportsQuery.isError ? (
        <QueryErrorState
          error={reportsQuery.error}
          onRetry={() => void reportsQuery.refetch()}
        />
      ) : null}
      {packsQuery.isError ? (
        <QueryErrorState
          error={packsQuery.error}
          onRetry={() => void packsQuery.refetch()}
        />
      ) : null}

      <StatGrid>
        <StatCard
          label={t("dashboard.plans")}
          value={formatNumber(
            report?.usage_by_channel.reduce(
              (total, entry) => total + entry.count,
              0,
            ) ?? 0,
          )}
        />
        <StatCard
          label={t("dashboard.rulePacks")}
          value={formatNumber(packs.length)}
        />
        <StatCard
          label={t("dashboard.audit")}
          value={formatNumber(report?.follow_rate_by_rule.length ?? 0)}
        />
      </StatGrid>
    </div>
  );
};
