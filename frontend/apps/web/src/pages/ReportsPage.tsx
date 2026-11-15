import type { Channel } from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import { useQuery } from "@tanstack/react-query";
import { Banner, Button, Icon, StatCard, StatGrid } from "@nextcrop/ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { LoadingPanel, QueryErrorState } from "../components/PageState";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";

const CHANNEL_KEYS: Record<Channel, string> = {
  sms: "consent.channelSms",
  ussd: "consent.channelUssd",
  web: "consent.channelWeb",
};


export const ReportsPage = () => {
  const { t, formatNumber, formatDateTime } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const reportsQuery = useQuery({
    queryKey: ["reports"],
    queryFn: () => api.getReports(),
  });

  const report = reportsQuery.data;

  const exportCsv = () => {
    if (!report || report.suppressed) return;
    const rows: string[][] = [["section", "key", "count", "extra"]];
    report.usage_by_channel.forEach((entry) =>
      rows.push(["channel", entry.channel, String(entry.count), ""]),
    );
    report.adoption_funnel.forEach((entry) =>
      rows.push(["funnel", entry.stage, String(entry.count), ""]),
    );
    report.follow_rate_by_rule.forEach((entry) =>
      rows.push([
        "follow_rate",
        entry.rule_id,
        String(entry.sample_size),
        String(entry.follow_rate),
      ]),
    );
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${cell.replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nextcrop-reports.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    showToast(t("common.saved"), "success");
  };

  return (
    <div className="page container">
      <PageHeader
        eyebrow={t("officer.scope")}
        title={t("officer.reportsTitle")}
        subtitle={t("officer.reportIntro")}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/officer")}>
              {t("common.back")}
            </Button>
            <Button
              onClick={exportCsv}
              disabled={!report || report.suppressed}
              icon={<Icon name="download" size={18} />}
            >
              {t("officer.exportCsv")}
            </Button>
          </>
        }
      />

      {reportsQuery.isLoading ? <LoadingPanel label={t("common.loading")} /> : null}
      {reportsQuery.isError ? (
        <QueryErrorState
          error={reportsQuery.error}
          onRetry={() => void reportsQuery.refetch()}
        />
      ) : null}

      {report ? (
        <div className="stack">
          {report.suppressed ? (
            <Banner tone="warn" title={t("officer.exportBlocked")}>
              {t("officer.suppressedNote")}
            </Banner>
          ) : null}
          <p className="pill">
            {t("officer.updated", { time: formatDateTime(report.generated_at) })}
          </p>
          <StatGrid>
            <StatCard
              label={t("officer.usageChannel")}
              value={formatNumber(
                report.usage_by_channel.reduce((sum, entry) => sum + entry.count, 0),
              )}
            />
            <StatCard
              label={t("officer.funnel")}
              value={formatNumber(report.adoption_funnel.at(-1)?.count ?? 0)}
            />
            <StatCard
              label={t("officer.followRate")}
              value={formatNumber(report.follow_rate_by_rule.length)}
            />
          </StatGrid>

          {user?.role === "extension_officer" ||
          user?.role === "cooperative" ||
          user?.role === "agronomist" ? (
            <p className="muted small">{t("officer.roleNote")}</p>
          ) : null}

          <div className="grid2">
            <section className="panel stack">
              <h2>{t("officer.usageChannel")}</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">{t("common.status")}</th>
                    <th scope="col">{t("common.count")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.usage_by_channel.map((entry) => (
                    <tr key={entry.channel}>
                      <td>{t(CHANNEL_KEYS[entry.channel])}</td>
                      <td>{formatNumber(entry.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="panel stack">
              <h2>{t("officer.funnel")}</h2>
              <ol className="funnelList">
                {report.adoption_funnel.map((entry) => (
                  <li key={entry.stage}>
                    <span>{t(`funnel.${entry.stage}`)}</span>
                    <strong>{formatNumber(entry.count)}</strong>
                  </li>
                ))}
              </ol>
              <h2>{t("officer.followRate")}</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">{t("plan.ruleIds")}</th>
                    <th scope="col">{t("officer.followRate")}</th>
                    <th scope="col">{t("officer.sampleSizeLabel")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.follow_rate_by_rule.map((entry) => (
                    <tr key={entry.rule_id}>
                      <td>{entry.rule_id}</td>
                      <td>
                        {formatNumber(entry.follow_rate, {
                          style: "percent",
                          maximumFractionDigits: 1,
                        })}
                      </td>
                      <td>{formatNumber(entry.sample_size)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
};
