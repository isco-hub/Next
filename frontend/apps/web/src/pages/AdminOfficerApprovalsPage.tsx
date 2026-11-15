import { useState } from "react";
import {
  findConstituency,
  findDistrict,
  findSubcounty,
  type ApprovalStatus,
} from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Field, selectClass } from "@nextcrop/ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { LoadingPanel, QueryErrorState } from "../components/PageState";
import { api } from "../lib/api";
import { useToast } from "../lib/toast";

const STATUS_TONE: Record<
  ApprovalStatus,
  "neutral" | "success" | "danger"
> = {
  pending: "neutral",
  approved: "success",
  rejected: "danger",
};

const STATUS_KEY: Record<ApprovalStatus, string> = {
  pending: "admin.officerPending",
  approved: "admin.officerApproved",
  rejected: "admin.officerRejected",
};

export const AdminOfficerApprovalsPage = () => {
  const { t, formatDateTime, formatNumber } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [status, setStatus] = useState<ApprovalStatus | "all">("pending");

  const registrationsQuery = useQuery({
    queryKey: ["officerRegistrations", status],
    queryFn: () =>
      api.listOfficerRegistrations(status === "all" ? undefined : status),
  });

  const decideMutation = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "approve" | "reject";
    }) =>
      action === "approve"
        ? api.approveOfficerRegistration(id)
        : api.rejectOfficerRegistration(id),
    onSuccess: (_, variables) => {
      showToast(
        variables.action === "approve"
          ? t("admin.officerApprovedToast")
          : t("admin.officerRejectedToast"),
      );
      void queryClient.invalidateQueries({ queryKey: ["officerRegistrations"] });
    },
  });

  const registrations = registrationsQuery.data ?? [];

  return (
    <div className="page container">
      <PageHeader
        eyebrow={t("nav.admin")}
        title={t("admin.officersTitle")}
        subtitle={t("admin.officersIntro")}
        actions={
          <Button variant="secondary" onClick={() => navigate("/admin/dashboard")}>
            {t("common.back")}
          </Button>
        }
      />

      <div className="row-between">
        <Field label={t("admin.filterStatus")} htmlFor="officer-status">
          <select
            id="officer-status"
            className={selectClass(false)}
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as ApprovalStatus | "all")
            }
          >
            <option value="pending">{t("admin.officerPending")}</option>
            <option value="approved">{t("admin.officerApproved")}</option>
            <option value="rejected">{t("admin.officerRejected")}</option>
            <option value="all">{t("admin.allStatuses")}</option>
          </select>
        </Field>
        <span className="pill">{formatNumber(registrations.length)}</span>
      </div>

      {registrationsQuery.isLoading ? (
        <LoadingPanel label={t("common.loading")} />
      ) : null}
      {registrationsQuery.isError ? (
        <QueryErrorState
          error={registrationsQuery.error}
          onRetry={() => void registrationsQuery.refetch()}
        />
      ) : null}

      {registrationsQuery.isSuccess ? (
        registrations.length === 0 ? (
          <p className="muted">{t("admin.officersEmpty")}</p>
        ) : (
          <div
            className="tableWrap"
            role="region"
            aria-label={t("admin.officersTitle")}
            tabIndex={0}
          >
            <table className="dataTable">
              <thead>
                <tr>
                  <th scope="col">{t("auth.nameLabel")}</th>
                  <th scope="col">{t("auth.phoneLabel")}</th>
                  <th scope="col">{t("admin.location")}</th>
                  <th scope="col">{t("admin.status")}</th>
                  <th scope="col">{t("admin.registered")}</th>
                  <th scope="col">{t("admin.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((entry) => {
                  const district = findDistrict(entry.district_id ?? undefined);
                  const constituency = findConstituency(
                    entry.constituency_id ?? undefined,
                  );
                  const subcounties = entry.subcounty_ids
                    .map((id) => findSubcounty(id)?.name)
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <tr key={entry.id}>
                      <td>{entry.display_name ?? "—"}</td>
                      <td>{entry.phone || "—"}</td>
                      <td>
                        {[district?.name, constituency?.name, subcounties]
                          .filter(Boolean)
                          .join(" · ")}
                      </td>
                      <td>
                        <Badge tone={STATUS_TONE[entry.approval_status]}>
                          {t(STATUS_KEY[entry.approval_status])}
                        </Badge>
                      </td>
                      <td>{formatDateTime(entry.created_at)}</td>
                      <td>
                        {entry.approval_status === "pending" ? (
                          <div className="row">
                            <Button
                              onClick={() =>
                                decideMutation.mutate({
                                  id: entry.id,
                                  action: "approve",
                                })
                              }
                              loading={
                                decideMutation.isPending &&
                                decideMutation.variables?.id === entry.id
                              }
                            >
                              {t("admin.approve")}
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() =>
                                decideMutation.mutate({
                                  id: entry.id,
                                  action: "reject",
                                })
                              }
                              disabled={decideMutation.isPending}
                            >
                              {t("admin.reject")}
                            </Button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  );
};
