import { useState } from "react";
import type { RulePack, RulePackStatus } from "@nextcrop/api-client";
import { SAMPLE_RULE_PACK_YAML } from "@nextcrop/testing";
import { useI18n } from "@nextcrop/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Banner,
  Button,
  Field,
  Icon,
  Sheet,
  inputClass,
  selectClass,
} from "@nextcrop/ui";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { LoadingPanel, QueryErrorState } from "../components/PageState";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { useToast } from "../lib/toast";

const STATUS_KEYS: Record<RulePackStatus, string> = {
  draft: "admin.draft",
  in_review: "admin.inReview",
  approved: "admin.approved",
  published: "admin.published",
  archived: "admin.archived",
};

const STATUS_TONE: Record<
  RulePackStatus,
  "neutral" | "info" | "warn" | "success" | "danger"
> = {
  draft: "neutral",
  in_review: "info",
  approved: "warn",
  published: "success",
  archived: "danger",
};

type PackAction =
  | { kind: "review"; pack: RulePack }
  | { kind: "approve"; pack: RulePack }
  | { kind: "publish"; pack: RulePack; mfa: string }
  | { kind: "rollback"; pack: RulePack };

export const AdminPacksPage = () => {
  const { t, formatDateTime, formatNumber } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [version, setVersion] = useState("");
  const [baseVersion, setBaseVersion] = useState("");
  const [createError, setCreateError] = useState("");
  const [actionError, setActionError] = useState("");
  const [publishPack, setPublishPack] = useState<RulePack | null>(null);
  const [mfa, setMfa] = useState("");
  const [mfaError, setMfaError] = useState("");

  const packsQuery = useQuery({
    queryKey: ["rulePacks"],
    queryFn: () => api.listRulePacks(),
  });

  const packs = packsQuery.data ?? [];
  const published = packs.find((pack) => pack.status === "published");

  const createMutation = useMutation({
    mutationFn: () =>
      api.createRulePack({
        version: version.trim(),
        yaml_document: SAMPLE_RULE_PACK_YAML,
        base_version: baseVersion || undefined,
      }),
    onSuccess: (pack) => {
      setCreateOpen(false);
      setVersion("");
      setBaseVersion("");
      setCreateError("");
      showToast(t("admin.packCreated"), "success");
      void queryClient.invalidateQueries({ queryKey: ["rulePacks"] });
      navigate(`/admin/rulepacks/${pack.id}`);
    },
    onError: (error) => setCreateError(errorMessage(error, t)),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: PackAction) => {
      if (action.kind === "review") {
        return api.submitRulePackForReview(action.pack.id);
      }
      if (action.kind === "approve") {
        return api.approveRulePack(action.pack.id);
      }
      if (action.kind === "publish") {
        return api.publishRulePack(action.pack.id, action.mfa);
      }
      return api.rollbackRulePack(action.pack.id);
    },
    onSuccess: (_pack, action) => {
      setActionError("");
      setMfa("");
      setMfaError("");
      setPublishPack(null);
      const key =
        action.kind === "review"
          ? "admin.reviewSubmitted"
          : action.kind === "approve"
            ? "admin.approvedSuccess"
            : action.kind === "publish"
              ? "admin.publishSuccess"
              : "admin.rollbackSuccess";
      showToast(t(key, { version: action.pack.version }), "success");
      void queryClient.invalidateQueries({ queryKey: ["rulePacks"] });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (error, action) => {
      if (action.kind === "publish") {
        setMfaError(errorMessage(error, t));
      } else {
        setActionError(errorMessage(error, t));
      }
    },
  });

  const buildDraft = () => {
    if (!version.trim()) {
      setCreateError(t("common.fieldRequired"));
      return;
    }
    setCreateError("");
    createMutation.mutate();
  };

  return (
    <div className="page container">
      <PageHeader
        eyebrow={t("nav.admin")}
        title={t("admin.title")}
        subtitle={t("admin.subtitle")}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => navigate("/admin/audit")}
              icon={<Icon name="file" size={18} />}
            >
              {t("admin.viewAudit")}
            </Button>
            <Button
              onClick={() => {
                setVersion("");
                setBaseVersion(published?.version ?? "");
                setCreateError("");
                setCreateOpen(true);
              }}
              icon={<Icon name="plus" size={18} />}
            >
              {t("admin.newPack")}
            </Button>
          </>
        }
      />

      <Banner tone="info" title={t("admin.workflowTitle")}>
        {t("admin.workflowHint")}
      </Banner>
      <p className="muted small">{t("admin.demoAdminHint")}</p>
      {actionError ? <Banner tone="error">{actionError}</Banner> : null}

      {packsQuery.isLoading ? <LoadingPanel label={t("common.loading")} /> : null}
      {packsQuery.isError ? (
        <QueryErrorState
          error={packsQuery.error}
          onRetry={() => void packsQuery.refetch()}
        />
      ) : null}

      <div className="stack">
        {packs.map((pack) => (
          <section key={pack.id} className="panel stack">
            <div className="row-between">
              <div>
                <div className="row">
                  <h2 style={{ margin: 0 }}>{t("admin.version")} {pack.version}</h2>
                  <Badge tone={STATUS_TONE[pack.status]}>
                    {t(STATUS_KEYS[pack.status])}
                  </Badge>
                  {pack.golden_tests_passed ? (
                    <Badge tone="success">{t("admin.goldenGate")}</Badge>
                  ) : null}
                </div>
                <p className="muted small">
                  {t("admin.rulePackStatus", {
                    status: t(STATUS_KEYS[pack.status]),
                  })}{" "}
                  · {t("admin.updated", { time: formatDateTime(pack.updated_at) })}
                </p>
                {pack.base_version ? (
                  <p className="muted small">
                    {t("admin.baseLabel", { version: pack.base_version })}
                  </p>
                ) : null}
              </div>
              <div className="row">
                <Link className="buttonLike" to={`/admin/rulepacks/${pack.id}`}>
                  {pack.status === "draft" ? t("admin.edit") : t("admin.actions")}
                </Link>
              </div>
            </div>

            <div className="row-between">
              <div className="row">
                <span className="pill">
                  {t("admin.packHash")}: {pack.pack_hash.slice(0, 12)}
                </span>
                <span className="pill">
                  {t("admin.testSummary", {
                    passed: formatNumber(
                      pack.golden_tests.filter((test) => test.pass).length,
                    ),
                    failed: formatNumber(
                      pack.golden_tests.filter((test) => !test.pass).length,
                    ),
                  })}
                </span>
                {pack.published_at ? (
                  <span className="pill">
                    {t("admin.lastPublished", {
                      time: formatDateTime(pack.published_at),
                    })}
                  </span>
                ) : null}
              </div>
              <div className="row">
                {pack.status === "draft" ? (
                  <Button
                    size="small"
                    variant="secondary"
                    loading={
                      actionMutation.isPending &&
                      actionMutation.variables?.kind === "review" &&
                      actionMutation.variables.pack.id === pack.id
                    }
                    onClick={() =>
                      actionMutation.mutate({ kind: "review", pack })
                    }
                  >
                    {t("admin.submitReview")}
                  </Button>
                ) : null}
                {pack.status === "in_review" ? (
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() =>
                      actionMutation.mutate({ kind: "approve", pack })
                    }
                  >
                    {t("admin.approve")}
                  </Button>
                ) : null}
                {pack.status === "approved" ? (
                  <Button
                    size="small"
                    onClick={() => {
                      setPublishPack(pack);
                      setMfa("");
                      setMfaError("");
                    }}
                  >
                    {t("admin.publish")}
                  </Button>
                ) : null}
                {pack.status === "published" ? (
                  <Button
                    size="small"
                    variant="dangerGhost"
                    onClick={() => {
                      if (
                        window.confirm(
                          t("admin.rollbackConfirm", { version: pack.version }),
                        )
                      ) {
                        actionMutation.mutate({ kind: "rollback", pack });
                      }
                    }}
                  >
                    {t("admin.rollback")}
                  </Button>
                ) : null}
              </div>
            </div>
          </section>
        ))}
        {packsQuery.isSuccess && packs.length === 0 ? (
          <p className="muted">{t("admin.packsIntro")}</p>
        ) : null}
      </div>

      <Sheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("admin.createPackTitle")}
        closeLabel={t("common.closeDialog")}
        footer={
          <div className="row-between">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={buildDraft}
              loading={createMutation.isPending}
              loadingLabel={t("common.submitting")}
            >
              {t("admin.create")}
            </Button>
          </div>
        }
      >
        <div className="stack">
          {createError ? <Banner tone="error">{createError}</Banner> : null}
          <Field label={t("admin.version")} htmlFor="new-version" required>
            <input
              id="new-version"
              className={inputClass(false)}
              placeholder={t("admin.versionPlaceholder")}
              value={version}
              onChange={(event) => setVersion(event.target.value)}
            />
          </Field>
          <Field label={t("admin.baseVersion")} htmlFor="new-base">
            <select
              id="new-base"
              className={selectClass(false)}
              value={baseVersion}
              onChange={(event) => setBaseVersion(event.target.value)}
            >
              <option value="">{t("common.none")}</option>
              {packs
                .filter((pack) => pack.status !== "archived")
                .map((pack) => (
                  <option key={pack.id} value={pack.version}>
                    {pack.version}
                  </option>
                ))}
            </select>
          </Field>
        </div>
      </Sheet>

      <Sheet
        open={Boolean(publishPack)}
        onClose={() => setPublishPack(null)}
        title={t("admin.mfaTitle")}
        closeLabel={t("common.closeDialog")}
        footer={
          <div className="row-between">
            <Button variant="secondary" onClick={() => setPublishPack(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (!publishPack) return;
                if (mfa.replace(/\D/g, "").length !== 6) {
                  setMfaError(t("admin.mfaRequired"));
                  return;
                }
                actionMutation.mutate({
                  kind: "publish",
                  pack: publishPack,
                  mfa,
                });
              }}
              loading={actionMutation.isPending}
              loadingLabel={t("common.submitting")}
            >
              {t("admin.confirmPublish")}
            </Button>
          </div>
        }
      >
        <div className="stack">
          <p>{t("admin.mfaIntro")}</p>
          <p className="pill">{t("admin.mfaDemoHint", { code: "123456" })}</p>
          {mfaError ? <Banner tone="error">{mfaError}</Banner> : null}
          <Field label={t("admin.mfaCode")} htmlFor="publish-mfa" required>
            <input
              id="publish-mfa"
              className={inputClass(false)}
              inputMode="numeric"
              maxLength={6}
              value={mfa}
              onChange={(event) =>
                setMfa(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </Field>
          {publishPack ? (
            <p className="muted small">
              {t("admin.version")} {publishPack.version}
            </p>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
};
