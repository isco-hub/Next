import { useEffect, useMemo, useRef, useState } from "react";
import {
  resolveLocation,
  type FlagCode,
  type Goal,
} from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Banner,
  Button,
  EmptyState,
  Field,
  Icon,
  PlanTimeline,
  Sheet,
  selectClass,
} from "@nextcrop/ui";
import { useNavigate, useSearchParams } from "react-router-dom";
import { QueryErrorState } from "../components/PageState";
import { Skeleton } from "@nextcrop/ui";
import { api, demoMode } from "../lib/api";
import { useAuth } from "../lib/auth";
import { readLastPlan, saveLastPlan } from "../lib/cache";
import { errorMessage } from "../lib/errors";
import { flagOptions, goalOptions } from "../lib/options";
import { useOnline } from "../lib/online";

export const PlanPage = () => {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const online = useOnline();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const preview = searchParams.get("preview") === "1";
  const queued = searchParams.get("queued") === "1";
  const [cached] = useState(readLastPlan);
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [goal, setGoal] = useState<Goal | "">("");
  const [flag, setFlag] = useState<FlagCode | "">("");
  const [detailed, setDetailed] = useState(false);
  const [whatIfError, setWhatIfError] = useState("");
  const idempotency = useRef("");

  const query = useQuery({
    queryKey: ["recommendation", id],
    queryFn: () => api.getRecommendation(id ?? ""),
    enabled: Boolean(id),
    retry: 1,
  });

  useEffect(() => {
    if (query.data && !preview) saveLastPlan(query.data);
  }, [query.data, preview]);

  const recommendation = useMemo(() => {
    if (query.data) return query.data;
    if (id) {
      return cached?.recommendation.id === id
        ? cached.recommendation
        : undefined;
    }
    return cached?.recommendation;
  }, [query.data, id, cached]);

  useEffect(() => {
    if (recommendation) setGoal(recommendation.inputs.goal);
  }, [recommendation]);

  const cachedAt =
    cached && recommendation && cached.recommendation.id === recommendation.id
      ? cached.cachedAt
      : null;

  const location = recommendation
    ? resolveLocation({
        lat: recommendation.inputs.lat,
        lon: recommendation.inputs.lon,
        district_id: recommendation.inputs.district_id,
        subcounty_id: recommendation.inputs.subcounty_id,
      })
    : null;

  const whatIf = useMutation({
    mutationFn: async () => {
      if (!recommendation) throw new Error("No recommendation");
      idempotency.current = `what-if-${Date.now()}`;
      const nextFlags = Array.from(
        new Set([
          ...(recommendation.inputs.flags ?? []),
          ...(flag ? [flag] : []),
        ]),
      ) as FlagCode[];
      return api.createRecommendation(
        {
          ...recommendation.inputs,
          goal: goal || recommendation.inputs.goal,
          flags: nextFlags,
          language: locale,
          channel: "web",
        },
        idempotency.current,
      );
    },
    onSuccess: (next) => {
      setWhatIfOpen(false);
      setWhatIfError("");
      navigate(`/plan?id=${encodeURIComponent(next.id)}&preview=1`);
    },
    onError: (error) => setWhatIfError(errorMessage(error, t)),
  });

  if (query.isLoading && !recommendation) {
    return (
      <div className="page container narrow">
        <Skeleton height="2rem" width="70%" />
        <Skeleton height="1rem" width="90%" />
        <Skeleton height="9rem" width="100%" />
      </div>
    );
  }

  if (query.isError && !recommendation) {
    return (
      <div className="page container narrow">
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  if (!recommendation || !location) {
    return (
      <div className="page container narrow">
        <EmptyState
          icon="file"
          title={queued ? t("wizard.queuedTitle") : t("plan.noPlanTitle")}
          body={queued ? t("wizard.queuedBody") : t("plan.noPlanBody")}
          action={
            <Button onClick={() => navigate(queued ? "/" : "/location")}>
              {queued ? t("common.backHome") : t("plan.startPlan")}
            </Button>
          }
        />
      </div>
    );
  }

  const crops = flagOptions(t);
  const goals = goalOptions(t);

  return (
    <div className="page container">
      {cachedAt ? (
        <Banner tone="info">{t("plan.offlineSaved")}</Banner>
      ) : null}
      {preview ? (
        <Banner tone="info" title={t("plan.whatIfTitle")}>
          {t("plan.whatIfBody")}
        </Banner>
      ) : null}

      <PlanTimeline
        recommendation={recommendation}
        detailed={detailed}
        sampleMode={demoMode}
        cachedAt={cachedAt}
        locationLabel={`${location.subcounty.name}, ${location.district.name}`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => window.print()}
              icon={<Icon name="print" size={18} />}
            >
              {t("plan.print")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setDetailed((value) => !value)}
              icon={<Icon name="file" size={18} />}
            >
              {detailed ? t("plan.hideDetails") : t("plan.viewDetails")}
            </Button>
            <Button
              onClick={() =>
                navigate(`/feedback?recommendation=${encodeURIComponent(recommendation.id)}`)
              }
              icon={<Icon name="send" size={18} />}
            >
              {t("plan.feedbackLink")}
            </Button>
            {user ? (
              <Button
                variant="secondary"
                onClick={() =>
                  navigate(
                    `/plots?fromPlan=${encodeURIComponent(recommendation.id)}`,
                  )
                }
                icon={<Icon name="plus" size={18} />}
              >
                {t("plan.goToPlots")}
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => navigate("/sign-in")}
                icon={<Icon name="user" size={18} />}
              >
                {t("plan.goToPlotsHint")}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => setWhatIfOpen(true)}
              disabled={!online}
              icon={<Icon name="sparkle" size={18} />}
            >
              {t("plan.whatIf")}
            </Button>
          </>
        }
      />

      <Sheet
        open={whatIfOpen}
        onClose={() => setWhatIfOpen(false)}
        title={t("plan.whatIfTitle")}
        closeLabel={t("common.closeDialog")}
        footer={
          <div className="row-between">
            <Button variant="secondary" onClick={() => setWhatIfOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => whatIf.mutate()}
              loading={whatIf.isPending}
              loadingLabel={t("plan.whatIfRunning")}
            >
              {t("plan.whatIfRun")}
            </Button>
          </div>
        }
      >
        <div className="stack">
          <p className="muted">{t("plan.whatIfBody")}</p>
          {whatIfError ? <Banner tone="error">{whatIfError}</Banner> : null}
          <Field label={t("plan.whatIfGoal")} htmlFor="what-if-goal">
            <select
              id="what-if-goal"
              className={selectClass(false)}
              value={goal}
              onChange={(event) => setGoal(event.target.value as Goal | "")}
            >
              {goals.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("plan.whatIfFlag")} htmlFor="what-if-flag">
            <select
              id="what-if-flag"
              className={selectClass(false)}
              value={flag}
              onChange={(event) => setFlag(event.target.value as FlagCode | "")}
            >
              <option value="">{t("plan.whatIfNone")}</option>
              {crops.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Sheet>
    </div>
  );
};
