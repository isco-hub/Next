import { useMemo, useState } from "react";
import { useI18n } from "@nextcrop/i18n";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Field, inputClass } from "@nextcrop/ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { LoadingPanel, QueryErrorState } from "../components/PageState";
import { api } from "../lib/api";

export const AdminAuditPage = () => {
  const { t, formatDateTime, formatNumber } = useI18n();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const auditQuery = useQuery({
    queryKey: ["audit"],
    queryFn: () => api.listAudit(),
  });

  const entries = auditQuery.data;
  const filtered = useMemo(() => {
    const source = entries ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return source;
    return source.filter((entry) =>
      [entry.actor, entry.action, entry.target, entry.detail, entry.trace_id]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [entries, search]);

  return (
    <div className="page container">
      <PageHeader
        eyebrow={t("nav.admin")}
        title={t("admin.auditTitle")}
        subtitle={t("admin.auditIntro")}
        actions={
          <Button variant="secondary" onClick={() => navigate("/admin")}>
            {t("common.back")}
          </Button>
        }
      />

      {auditQuery.isLoading ? <LoadingPanel label={t("common.loading")} /> : null}
      {auditQuery.isError ? (
        <QueryErrorState
          error={auditQuery.error}
          onRetry={() => void auditQuery.refetch()}
        />
      ) : null}

      {auditQuery.isSuccess ? (
        <div className="stack">
          <div className="row-between">
            <Field label={t("common.search")} htmlFor="audit-search">
              <input
                id="audit-search"
                className={inputClass(false)}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("admin.actor")}
              />
            </Field>
            <span className="pill">{formatNumber(filtered.length)}</span>
          </div>

          {filtered.length === 0 ? (
            <p className="muted">{t("admin.auditEmpty")}</p>
          ) : (
            <div
              className="tableWrap"
              role="region"
              aria-label={t("admin.auditTitle")}
              tabIndex={0}
            >
              <table className="dataTable">
                <thead>
                  <tr>
                    <th scope="col">{t("admin.when")}</th>
                    <th scope="col">{t("admin.actor")}</th>
                    <th scope="col">{t("admin.action")}</th>
                    <th scope="col">{t("admin.target")}</th>
                    <th scope="col">{t("admin.detail")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.at)}</td>
                      <td>{entry.actor}</td>
                      <td>
                        <Badge tone="info">{entry.action}</Badge>
                      </td>
                      <td>{entry.target}</td>
                      <td>
                        {entry.detail}
                        <br />
                        <span className="muted small">
                          {t("common.traceId", { traceId: entry.trace_id })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
