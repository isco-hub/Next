import { useI18n } from "@nextcrop/i18n";
import { useQuery } from "@tanstack/react-query";
import { Button, Icon, StatCard, StatGrid } from "@nextcrop/ui";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { LoadingPanel, QueryErrorState } from "../components/PageState";
import { api } from "../lib/api";

export const AdminDashboardPage = () => {
  const { t, formatNumber } = useI18n();
  const navigate = useNavigate();
  const packsQuery = useQuery({
    queryKey: ["adminRulePacks"],
    queryFn: () => api.listRulePacks(),
  });
  const reportsQuery = useQuery({
    queryKey: ["adminReports"],
    queryFn: () => api.getReports(),
  });
  const packs = packsQuery.data ?? [];
  const report = reportsQuery.data;
  const published = packs.filter((pack) => pack.status === "published").length;

  return (
    <div className="page container">
      <PageHeader
        eyebrow={t("auth.roleAdmin")}
        title={t("dashboard.adminTitle")}
        subtitle={t("dashboard.adminIntro")}
        actions={
          <>
            <Button
              onClick={() => navigate("/admin/rulepacks")}
              icon={<Icon name="shield" size={18} />}
            >
              {t("dashboard.manageRulePacks")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate("/admin/audit")}
              icon={<Icon name="file" size={18} />}
            >
              {t("dashboard.audit")}
            </Button>
          </>
        }
      />

      {packsQuery.isLoading || reportsQuery.isLoading ? (
        <LoadingPanel label={t("common.loading")} />
      ) : null}
      {packsQuery.isError ? (
        <QueryErrorState
          error={packsQuery.error}
          onRetry={() => void packsQuery.refetch()}
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
          label={t("dashboard.rulePacks")}
          value={formatNumber(packs.length)}
        />
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
          label={t("dashboard.reports")}
          value={formatNumber(report?.adoption_funnel.length ?? 0)}
        />
        <StatCard
          label={t("dashboard.publishedPacks")}
          value={formatNumber(published)}
        />
      </StatGrid>

      <section className="panel stack">
        <div>
          <h2>{t("dashboard.platformTools")}</h2>
          <p className="muted small">{t("dashboard.fullAccessHint")}</p>
        </div>
        <div className="quickGrid">
          <Link className="quickCard" to="/admin/rulepacks">
            <div className="quickCardIcon"><Icon name="shield" size={20} /></div>
            <h3>{t("dashboard.manageRulePacks")}</h3>
            <p className="muted small">{t("dashboard.manageRulePacksIntro")}</p>
          </Link>
          <Link className="quickCard" to="/admin/audit">
            <div className="quickCardIcon"><Icon name="file" size={20} /></div>
            <h3>{t("dashboard.audit")}</h3>
            <p className="muted small">{t("dashboard.auditIntro")}</p>
          </Link>
          <Link className="quickCard" to="/reports">
            <div className="quickCardIcon"><Icon name="chart" size={20} /></div>
            <h3>{t("dashboard.reports")}</h3>
            <p className="muted small">{t("dashboard.reportsIntro")}</p>
          </Link>
          <Link className="quickCard" to="/admin/translations">
            <div className="quickCardIcon"><Icon name="file" size={20} /></div>
            <h3>{t("dashboard.translations")}</h3>
            <p className="muted small">{t("dashboard.translationsIntro")}</p>
          </Link>
          <Link className="quickCard" to="/farmer">
            <div className="quickCardIcon"><Icon name="sprout" size={20} /></div>
            <h3>{t("dashboard.farmerWorkspace")}</h3>
            <p className="muted small">{t("dashboard.farmerWorkspaceIntro")}</p>
          </Link>
          <Link className="quickCard" to="/extension">
            <div className="quickCardIcon"><Icon name="users" size={20} /></div>
            <h3>{t("dashboard.extensionWorkspace")}</h3>
            <p className="muted small">{t("dashboard.extensionWorkspaceIntro")}</p>
          </Link>
        </div>
      </section>
    </div>
  );
};
