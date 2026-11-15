import { useEffect, useMemo, useRef, useState } from "react";
import type { RulePackStatus } from "@nextcrop/api-client";
import { sampleRequest } from "@nextcrop/testing";
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
  textareaClass,
} from "@nextcrop/ui";
import { useNavigate, useParams } from "react-router-dom";
import YAML from "yaml";
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

const REQUIRED_FIELDS = [
  "version",
  "seasons",
  "families",
  "season_gate",
  "hard_rules",
  "moisture_gate",
];

interface DiffRow {
  kind: "same" | "add" | "remove";
  lineNo: number;
  text: string;
}

const diffLines = (before: string, after: string): DiffRow[] => {
  const a = before.split("\n");
  const b = after.split("\n");
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  );

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i]![j] =
        a[i] === b[j]
          ? (table[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(table[i + 1]?.[j] ?? 0, table[i]?.[j + 1] ?? 0);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      rows.push({ kind: "same", lineNo: i + 1, text: a[i] ?? "" });
      i += 1;
      j += 1;
    } else if ((table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0)) {
      rows.push({ kind: "remove", lineNo: i + 1, text: a[i] ?? "" });
      i += 1;
    } else {
      rows.push({ kind: "add", lineNo: j + 1, text: b[j] ?? "" });
      j += 1;
    }
  }
  while (i < a.length) {
    rows.push({ kind: "remove", lineNo: i + 1, text: a[i] ?? "" });
    i += 1;
  }
  while (j < b.length) {
    rows.push({ kind: "add", lineNo: j + 1, text: b[j] ?? "" });
    j += 1;
  }
  return rows;
};

export const AdminPackEditorPage = () => {
  const { id } = useParams();
  const { t, formatDateTime, formatNumber } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [yaml, setYaml] = useState("");
  const [baseline, setBaseline] = useState("");
  const [validation, setValidation] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [mfa, setMfa] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [simulationError, setSimulationError] = useState("");
  const [simulation, setSimulation] = useState<
    Awaited<ReturnType<typeof api.simulateRulePack>> | null
  >(null);
  const initialised = useRef("");

  const packQuery = useQuery({
    queryKey: ["rulePack", id],
    queryFn: () => api.getRulePack(id ?? ""),
    enabled: Boolean(id),
  });

  const pack = packQuery.data;

  useEffect(() => {
    if (!pack || initialised.current === pack.id) return;
    initialised.current = pack.id;
    setYaml(pack.yaml_document);
    setBaseline(pack.yaml_document);
  }, [pack]);

  const checkYaml = (): boolean => {
    if (!yaml.trim()) {
      setValidation({ tone: "error", message: t("admin.yamlEmpty") });
      return false;
    }
    try {
      const parsed = parseYaml(yaml);
      if (!parsed || typeof parsed !== "object") {
        setValidation({ tone: "error", message: t("admin.validationError") });
        return false;
      }
      const record = parsed as Record<string, unknown>;
      const missing = REQUIRED_FIELDS.find((field) => !(field in record));
      if (missing) {
        setValidation({
          tone: "error",
          message: t("admin.missingField", { field: missing }),
        });
        return false;
      }
      setValidation({ tone: "success", message: t("admin.validationOk") });
      return true;
    } catch (parseError) {
      const line =
        (parseError as { linePos?: { line: number }[] }).linePos?.[0]?.line ?? 0;
      setValidation({
        tone: "error",
        message: t("admin.yamlParse", {
          line,
          message:
            parseError instanceof Error
              ? parseError.message
              : t("admin.validationError"),
        }),
      });
      return false;
    }
  };

  const saveMutation = useMutation({
    mutationFn: () => api.updateRulePack(pack?.id ?? "", yaml),
    onSuccess: (updated) => {
      setError("");
      setBaseline(updated.yaml_document);
      setYaml(updated.yaml_document);
      showToast(t("admin.draftSaved"), "success");
      void queryClient.invalidateQueries({ queryKey: ["rulePacks"] });
      void queryClient.invalidateQueries({ queryKey: ["rulePack", id] });
    },
    onError: (saveError) => setError(errorMessage(saveError, t)),
  });

  const testsMutation = useMutation({
    mutationFn: () => api.runGoldenTests(pack?.id ?? ""),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["rulePack", id] });
      void queryClient.invalidateQueries({ queryKey: ["rulePacks"] });
    },
    onError: (testsError) =>
      setError(t("admin.testsError") + " " + errorMessage(testsError, t)),
  });

  const workflowMutation = useMutation({
    mutationFn: (kind: "review" | "approve" | "publish" | "rollback") => {
      if (!pack) throw new Error(t("admin.loadError"));
      if (kind === "review") return api.submitRulePackForReview(pack.id);
      if (kind === "approve") return api.approveRulePack(pack.id);
      if (kind === "publish") return api.publishRulePack(pack.id, mfa);
      return api.rollbackRulePack(pack.id);
    },
    onSuccess: (_updated, kind) => {
      setError("");
      setPublishOpen(false);
      setMfa("");
      setMfaError("");
      const key =
        kind === "review"
          ? "admin.reviewSubmitted"
          : kind === "approve"
            ? "admin.approvedSuccess"
            : kind === "publish"
              ? "admin.publishSuccess"
              : "admin.rollbackSuccess";
      showToast(t(key, { version: pack?.version ?? "" }), "success");
      void queryClient.invalidateQueries({ queryKey: ["rulePack", id] });
      void queryClient.invalidateQueries({ queryKey: ["rulePacks"] });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (workflowError) => {
      if (publishOpen) setMfaError(errorMessage(workflowError, t));
      else setError(errorMessage(workflowError, t));
    },
  });

  const simulationMutation = useMutation({
    mutationFn: () =>
      api.simulateRulePack(pack?.id ?? "", sampleRequest({ seasons: 4 })),
    onSuccess: (result) => {
      setSimulationError("");
      setSimulation(result);
    },
    onError: (simulateError) =>
      setSimulationError(
        t("admin.simulateError") + " " + errorMessage(simulateError, t),
      ),
  });

  const rows = useMemo(() => diffLines(baseline, yaml), [baseline, yaml]);
  const hasDiff = rows.some((row) => row.kind !== "same");

  if (!id) {
    return (
      <div className="page container">
        <Banner tone="error">{t("admin.loadError")}</Banner>
        <Button onClick={() => navigate("/admin")}>{t("common.back")}</Button>
      </div>
    );
  }

  return (
    <div className="page container">
      <PageHeader
        eyebrow={t("nav.admin")}
        title={t("admin.editorTitle")}
        subtitle={t("admin.editorIntro")}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/admin")}>
              {t("common.back")}
            </Button>
            <Button variant="secondary" onClick={checkYaml}>
              {t("admin.validate")}
            </Button>
            <Button
              onClick={() => {
                if (checkYaml()) saveMutation.mutate();
              }}
              loading={saveMutation.isPending}
              loadingLabel={t("common.submitting")}
              disabled={pack?.status !== "draft"}
              icon={<Icon name="check" size={18} />}
            >
              {t("admin.saveDraft")}
            </Button>
          </>
        }
      />

      {packQuery.isLoading ? <LoadingPanel label={t("common.loading")} /> : null}
      {packQuery.isError ? (
        <QueryErrorState
          error={packQuery.error}
          onRetry={() => void packQuery.refetch()}
        />
      ) : null}

      {pack ? (
        <div className="stack">
          <div className="row-between">
            <div className="row">
              <Badge tone="info">{t("admin.version")} {pack.version}</Badge>
              <Badge>{t(STATUS_KEYS[pack.status])}</Badge>
              {pack.base_version ? (
                <span className="pill">
                  {t("admin.baseLabel", { version: pack.base_version })}
                </span>
              ) : null}
              <span className="pill">
                {t("admin.updated", { time: formatDateTime(pack.updated_at) })}
              </span>
            </div>
            <span className="muted small">
              {t("admin.currentUserDemo", { name: pack.created_by })}
            </span>
          </div>

          {error ? <Banner tone="error">{error}</Banner> : null}
          <Banner tone="warn" title={t("admin.twoPersonHint")}>
            {t("admin.approvalRoleNote")}
          </Banner>
          {validation ? (
            <Banner tone={validation.tone === "success" ? "success" : "error"}>
              {validation.message}
            </Banner>
          ) : null}

          <div className="grid2">
            <section className="panel stack">
              <h2>{t("admin.editorTitle")}</h2>
              <Field
                label={t("admin.yamlLabel")}
                htmlFor="pack-yaml"
                hint={t("admin.schemaHint")}
              >
                <textarea
                  id="pack-yaml"
                  className={`${textareaClass(false)} editorArea`}
                  aria-label={t("admin.editorAria")}
                  spellCheck={false}
                  value={yaml}
                  onChange={(event) => {
                    setYaml(event.target.value);
                    setValidation(null);
                  }}
                  disabled={pack.status !== "draft"}
                />
              </Field>
              <div className="row">
                <Button
                  variant="secondary"
                  onClick={() =>
                    workflowMutation.mutate("review")
                  }
                  disabled={pack.status !== "draft"}
                  loading={
                    workflowMutation.isPending &&
                    workflowMutation.variables === "review"
                  }
                >
                  {t("admin.submitReview")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => workflowMutation.mutate("approve")}
                  disabled={pack.status !== "in_review"}
                  loading={
                    workflowMutation.isPending &&
                    workflowMutation.variables === "approve"
                  }
                >
                  {t("admin.approve")}
                </Button>
                <Button
                  onClick={() => {
                    setMfa("");
                    setMfaError("");
                    setPublishOpen(true);
                  }}
                  disabled={pack.status !== "approved"}
                >
                  {t("admin.publish")}
                </Button>
                <Button
                  variant="dangerGhost"
                  onClick={() => workflowMutation.mutate("rollback")}
                  disabled={pack.status !== "published"}
                >
                  {t("admin.rollback")}
                </Button>
              </div>
            </section>

            <section className="panel stack">
              <div>
                <h2>{t("admin.diffTitle", { version: pack.base_version ?? "—" })}</h2>
                <p className="muted small">{t("admin.diffPrevious")}</p>
              </div>
              <div className="diff" aria-label={t("admin.diffAria")} role="region">
                {hasDiff ? (
                  rows.map((row, index) => (
                    <div
                      key={`${row.kind}-${row.lineNo}-${index}`}
                      className={`diffLine ${
                        row.kind === "add"
                          ? "diffAdd"
                          : row.kind === "remove"
                            ? "diffRemove"
                            : ""
                      }`}
                    >
                      <span className="diffLineNo">{row.lineNo}</span>
                      <span>{row.text || " "}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted" style={{ padding: "1rem" }}>
                    {t("admin.noDiff")}
                  </p>
                )}
              </div>
            </section>
          </div>

          <section className="panel stack">
            <div className="row-between">
              <div>
                <h2>{t("admin.goldenTitle")}</h2>
                <p className="muted small">{t("admin.goldenIntro")}</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => testsMutation.mutate()}
                loading={testsMutation.isPending}
                loadingLabel={t("common.submitting")}
              >
                {t("admin.runTests")}
              </Button>
            </div>
            {pack.golden_tests_passed ? (
              <Banner tone="success">
                {t("admin.testsPassed", {
                  count: pack.golden_tests.filter((test) => test.pass).length,
                })}
              </Banner>
            ) : (
              <Banner tone="warn">{t("admin.blockedPublish")}</Banner>
            )}
            <div
              className="tableWrap"
              role="region"
              aria-label={t("admin.goldenTitle")}
              tabIndex={0}
            >
              <table className="dataTable">
                <thead>
                  <tr>
                    <th scope="col">{t("admin.scenario")}</th>
                    <th scope="col">{t("admin.expected")}</th>
                    <th scope="col">{t("admin.actual")}</th>
                    <th scope="col">{t("admin.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.golden_tests.map((test) => (
                    <tr key={test.id}>
                      <td>{test.id} · {test.scenario}</td>
                      <td>{test.expected}</td>
                      <td>{test.actual}</td>
                      <td>
                        <Badge tone={test.pass ? "success" : "danger"}>
                          {test.pass ? t("admin.pass") : t("admin.fail")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel stack">
            <div className="row-between">
              <div>
                <h2>{t("admin.simulatorTitle")}</h2>
                <p className="muted small">{t("admin.simulatorIntro")}</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => simulationMutation.mutate()}
                loading={simulationMutation.isPending}
                loadingLabel={t("admin.runSimulation")}
                icon={<Icon name="sparkle" size={18} />}
              >
                {t("admin.runSimulation")}
              </Button>
            </div>
            {simulationError ? <Banner tone="error">{simulationError}</Banner> : null}
            {simulation ? (
              <div className="stack">
                <h3>{t("admin.simulationResult")}</h3>
                <div className="choiceRow">
                  {simulation.seasons.map((season) => (
                    <span key={season.season_index} className="pill">
                      {t("plan.seasonN", { index: season.season_index })} ·{" "}
                      {t(`common.crop.${season.crop}`)}
                    </span>
                  ))}
                </div>
                <h3>{t("admin.ruleTrace")}</h3>
                {simulation.trace.map((trace) => (
                  <div key={trace.season_index} className="stack">
                    <strong>
                      {t("admin.traceSeason", {
                        index: trace.season_index,
                        season: simulation.seasons[trace.season_index - 1]?.season ?? "",
                      })}
                    </strong>
                    <div
                      className="tableWrap"
                      role="region"
                      aria-label={t("admin.ruleTrace")}
                      tabIndex={0}
                    >
                      <table className="dataTable">
                        <thead>
                          <tr>
                            <th scope="col">{t("admin.candidates")}</th>
                            <th scope="col">{t("admin.score")}</th>
                            <th scope="col">{t("admin.excluded")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trace.candidates.map((candidate) => (
                            <tr key={candidate.crop}>
                              <td>{t(`common.crop.${candidate.crop}`)}</td>
                              <td>{formatNumber(candidate.score)}</td>
                              <td>
                                {candidate.excluded
                                  ? candidate.reason_rule ?? t("common.yes")
                                  : t("common.no")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">{t("admin.noTrace")}</p>
            )}
          </section>
        </div>
      ) : null}

      <Sheet
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title={t("admin.mfaTitle")}
        closeLabel={t("common.closeDialog")}
        footer={
          <div className="row-between">
            <Button variant="secondary" onClick={() => setPublishOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (mfa.replace(/\D/g, "").length !== 6) {
                  setMfaError(t("admin.mfaRequired"));
                  return;
                }
                workflowMutation.mutate("publish");
              }}
              loading={workflowMutation.isPending}
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
          <Field label={t("admin.mfaCode")} htmlFor="editor-mfa" required>
            <input
              id="editor-mfa"
              className={inputClass(false)}
              inputMode="numeric"
              maxLength={6}
              value={mfa}
              onChange={(event) =>
                setMfa(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </Field>
        </div>
      </Sheet>
    </div>
  );
};

const parseYaml = (source: string): unknown => {
  const parsed = YAML.parse(source) as unknown;
  if (!parsed || typeof parsed !== "object") return null;
  return parsed;
};
