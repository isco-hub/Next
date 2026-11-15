import { useMemo, useRef, useState } from "react";
import {
  ApiError,
  type CropCode,
  type FeedbackInput,
  type Recommendation,
} from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import { useQuery } from "@tanstack/react-query";
import {
  Banner,
  Button,
  CropIcon,
  EmptyState,
  Field,
  Icon,
  OptionCard,
  OptionGroup,
  textareaClass,
  selectClass,
} from "@nextcrop/ui";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { LoadingPanel, QueryErrorState } from "../components/PageState";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { enqueueFeedback, readLastPlan } from "../lib/cache";
import { cropOptions } from "../lib/options";
import { errorMessage } from "../lib/errors";
import { useOnline } from "../lib/online";

type Rating = "better" | "same" | "worse";

export const FeedbackPage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const online = useOnline();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get("recommendation");
  const [lastPlan] = useState(readLastPlan);
  const [cachedOnly] = useState<Recommendation | null>(
    lastPlan?.recommendation ?? null,
  );
  const [planted, setPlanted] = useState<CropCode>(
    cachedOnly?.seasons[0]?.crop ?? "maize",
  );
  const [followed, setFollowed] = useState(true);
  const [rating, setRating] = useState<Rating | null>(null);
  const [thumbs, setThumbs] = useState<"up" | "down" | null>(null);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [queued, setQueued] = useState(false);
  const idempotency = useRef("");

  const targetId =
    requestedId ??
    (cachedOnly && !requestedId ? cachedOnly.id : null);

  const query = useQuery({
    queryKey: ["recommendation", targetId],
    queryFn: () => api.getRecommendation(targetId ?? ""),
    enabled: Boolean(targetId) && cachedOnly?.id !== targetId,
    retry: 1,
  });

  const recommendation =
    cachedOnly && cachedOnly.id === targetId ? cachedOnly : query.data;

  const crops = useMemo(() => cropOptions(t), [t]);

  const showSignIn = !user;

  const submit = async () => {
    if (!recommendation) return;
    if (!user) {
      navigate("/sign-in", {
        state: {
          from: `/feedback?recommendation=${encodeURIComponent(recommendation.id)}`,
        },
      });
      return;
    }
    const input: FeedbackInput = {
      recommendation_id: recommendation.id,
      season: recommendation.seasons[0]?.season ?? "A",
      followed,
      crop_planted: planted,
      rating: rating ?? undefined,
      thumbs: thumbs ?? undefined,
      reason_code: reason || undefined,
      comment: comment.trim() || undefined,
    };
    if (!online) {
      enqueueFeedback(input);
      setQueued(true);
      return;
    }
    setSubmitting(true);
    setError("");
    idempotency.current = `feedback-${Date.now()}`;
    try {
      await api.submitFeedback(input, idempotency.current);
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.isNetworkError) {
        enqueueFeedback(input);
        setQueued(true);
      } else {
        setError(errorMessage(err, t));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (query.isLoading) {
    return (
      <div className="page container narrow">
        <LoadingPanel label={t("common.loading")} />
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

  if (!recommendation) {
    return (
      <div className="page container narrow">
        <EmptyState
          icon="file"
          title={t("plan.noPlanTitle")}
          body={t("plan.noPlanBody")}
          action={
            <Button onClick={() => navigate("/location")}>
              {t("plan.startPlan")}
            </Button>
          }
        />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="page container narrow">
        <PageHeader title={t("feedback.submitted")} />
        <EmptyState
          icon="check"
          title={t("feedback.thanksTitle")}
          body={t("feedback.thanksBody")}
          action={
            <div className="row">
              <Button
                onClick={() =>
                  navigate(`/plan?id=${encodeURIComponent(recommendation.id)}`)
                }
              >
                {t("feedback.planLink")}
              </Button>
              <Button variant="secondary" onClick={() => navigate("/plots")}>
                {t("nav.myPlots")}
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  if (queued) {
    return (
      <div className="page container narrow">
        <PageHeader title={t("feedback.title")} />
        <Banner tone="info" title={t("wizard.queuedTitle")}>
          {t("feedback.offlineQueued")}
        </Banner>
        <div className="row">
          <Button
            onClick={() =>
              navigate(`/plan?id=${encodeURIComponent(recommendation.id)}`)
            }
          >
            {t("feedback.planLink")}
          </Button>
          <Button variant="secondary" onClick={() => navigate("/")}>
            {t("common.backHome")}
          </Button>
        </div>
      </div>
    );
  }

  const ratingOptions: { value: Rating; label: string }[] = [
    { value: "better", label: t("feedback.better") },
    { value: "same", label: t("feedback.same") },
    { value: "worse", label: t("feedback.worse") },
  ];

  return (
    <div className="page container narrow">
      <PageHeader title={t("feedback.title")} subtitle={t("feedback.subtitle")} />

      {showSignIn ? (
        <Banner tone="info" title={t("plots.signInTitle")}>
          {t("plots.signInBody")}{" "}
          <Button
            size="small"
            variant="secondary"
            onClick={() =>
              navigate("/sign-in", {
                state: {
                  from: `/feedback?recommendation=${encodeURIComponent(recommendation.id)}`,
                },
              })
            }
          >
            {t("nav.signIn")}
          </Button>
        </Banner>
      ) : null}

      {error ? <Banner tone="error">{error}</Banner> : null}

      <section className="panel stack">
        <Field label={t("feedback.plantedTitle")} htmlFor="feedback-crop" required>
          <select
            id="feedback-crop"
            className={selectClass(false)}
            value={planted}
            onChange={(event) => setPlanted(event.target.value as CropCode)}
          >
            {crops.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <OptionGroup label={t("feedback.followedTitle")}>
          <div className="choiceGrid">
            <OptionCard
              title={t("feedback.followedYes")}
              selected={followed}
              onSelect={() => setFollowed(true)}
              icon={<Icon name="check" size={20} />}
            />
            <OptionCard
              title={t("feedback.followedNo")}
              selected={!followed}
              onSelect={() => setFollowed(false)}
              icon={<Icon name="close" size={20} />}
            />
          </div>
        </OptionGroup>

        <OptionGroup
          label={t("feedback.ratingTitle")}
          hint={t("feedback.ratingOptional")}
        >
          <div className="choiceGrid">
            {ratingOptions.map((option) => (
              <OptionCard
                key={option.value}
                title={option.label}
                selected={rating === option.value}
                onSelect={() => setRating(option.value)}
              />
            ))}
          </div>
        </OptionGroup>

        <OptionGroup label={t("feedback.thumbsTitle")}>
          <div className="choiceGrid">
            <OptionCard
              title={t("feedback.thumbsUp")}
              selected={thumbs === "up"}
              onSelect={() => setThumbs("up")}
              icon={<Icon name="check" size={20} />}
            />
            <OptionCard
              title={t("feedback.thumbsDown")}
              selected={thumbs === "down"}
              onSelect={() => setThumbs("down")}
              icon={<Icon name="close" size={20} />}
            />
          </div>
        </OptionGroup>

        <Field
          label={thumbs === "down" ? t("feedback.reasonForDown") : t("feedback.reasonTitle")}
          htmlFor="feedback-reason"
        >
          <select
            id="feedback-reason"
            className={selectClass(false)}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            <option value="">{t("common.none")}</option>
            <option value="price">{t("feedback.reasonPrice")}</option>
            <option value="seed">{t("feedback.reasonSeed")}</option>
            <option value="labour">{t("feedback.reasonLabour")}</option>
            <option value="weather">{t("feedback.reasonWeather")}</option>
            <option value="land">{t("feedback.reasonLand")}</option>
            <option value="other">{t("feedback.reasonOther")}</option>
          </select>
        </Field>

        <Field
          label={t("feedback.commentLabel")}
          htmlFor="feedback-comment"
          hint={t("feedback.commentPlaceholder")}
        >
          <textarea
            id="feedback-comment"
            className={textareaClass(false)}
            value={comment}
            maxLength={500}
            rows={4}
            onChange={(event) => setComment(event.target.value)}
          />
        </Field>
        <p className="muted small" style={{ marginBottom: 0 }}>
          {t("common.characters", { count: comment.length })}
        </p>
      </section>

      <div className="row-between">
        <Button
          variant="secondary"
          onClick={() =>
            navigate(`/plan?id=${encodeURIComponent(recommendation.id)}`)
          }
        >
          {t("feedback.skip")}
        </Button>
        <Button
          onClick={() => {
            void submit();
          }}
          loading={submitting}
          loadingLabel={t("common.submitting")}
          icon={<CropIcon code={planted} size={18} />}
        >
          {t("feedback.submit")}
        </Button>
      </div>
    </div>
  );
};
