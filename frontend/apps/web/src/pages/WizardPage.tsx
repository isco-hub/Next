import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  resolveLocation,
  type CropCode,
  type FlagCode,
  type RecommendationRequest,
} from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import {
  Banner,
  Button,
  CropIcon,
  Field,
  Icon,
  OptionCard,
  OptionGroup,
  Stepper,
  selectClass,
  type IconName,
} from "@nextcrop/ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import {
  enqueueRecommendation,
  listQueuedRecommendations,
  markRecommendationAttempt,
  removeQueuedRecommendation,
  saveLastPlan,
} from "../lib/cache";
import { readLocationDraft, readWizardDraft, saveWizardDraft, type WizardDraft } from "../lib/draft";
import { errorMessage } from "../lib/errors";
import {
  cropOptions,
  flagOptions,
  goalOptions,
  seasonOptions,
  soilOptions,
} from "../lib/options";
import { useOnline } from "../lib/online";
import { useToast } from "../lib/toast";

const GOAL_ICONS: Record<string, IconName> = {
  restore_soil: "refresh",
  max_cash: "chart",
  drought_survival: "sun",
};

type ErrorKey =
  | "wizard.requiredCrop"
  | "wizard.requiredSoil"
  | "wizard.requiredGoal"
  | "wizard.requiredSeasons"
  | "";

export const WizardPage = () => {
  const { t, locale } = useI18n();
  const online = useOnline();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [location] = useState(readLocationDraft);
  const [draft, setDraft] = useState<WizardDraft>(() => readWizardDraft(locale));
  const [step, setStep] = useState(0);
  const [errorKey, setErrorKey] = useState<ErrorKey>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");
  const [queuedId, setQueuedId] = useState<string | null>(null);
  const [, setQueueTick] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const idempotency = useRef<string>("");

  useEffect(() => {
    saveWizardDraft(draft);
  }, [draft]);

  useEffect(() => {
    if (!queuedId) return;
    const timer = window.setInterval(() => setQueueTick((value) => value + 1), 3_000);
    return () => window.clearInterval(timer);
  }, [queuedId]);

  const queuedItem = queuedId
    ? listQueuedRecommendations().find((item) => item.id === queuedId)
    : undefined;
  const queuedStillWaiting = Boolean(queuedId && queuedItem);
  const queuedAndSent = Boolean(queuedId && !queuedItem);

  const crops = useMemo(() => cropOptions(t), [t]);
  const soils = useMemo(() => soilOptions(t), [t]);
  const goals = useMemo(() => goalOptions(t), [t]);
  const flags = useMemo(() => flagOptions(t), [t]);
  const seasons = useMemo(() => seasonOptions(t), [t]);
  const primaryCrop = draft.previous_crops[0] ?? null;
  const secondCrop = draft.previous_crops[1] ?? null;

  const steps = [
    t("wizard.cropStepLabel"),
    t("wizard.soilStepLabel"),
    t("wizard.goalStepLabel"),
    t("wizard.reviewTitle"),
  ];

  const resolvedLocation = location ? resolveLocation(location) : null;

  const validateStep = (): boolean => {
    if (step === 0 && !primaryCrop) {
      setErrorKey("wizard.requiredCrop");
      return false;
    }
    if (step === 1 && !draft.soil_type) {
      setErrorKey("wizard.requiredSoil");
      return false;
    }
    if (step === 2) {
      if (!draft.goal) {
        setErrorKey("wizard.requiredGoal");
        return false;
      }
      if (draft.seasons < 2 || draft.seasons > 6) {
        setErrorKey("wizard.requiredSeasons");
        return false;
      }
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    setErrorKey("");
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const back = () => {
    setErrorKey("");
    setStep((current) => Math.max(current - 1, 0));
  };

  const buildRequest = (): RecommendationRequest | null => {
    if (!location || !resolvedLocation) return null;
    if (!primaryCrop || !draft.soil_type || !draft.goal) return null;
    return {
      lat: location.lat,
      lon: location.lon,
      district_id: resolvedLocation.district.id,
      subcounty_id: resolvedLocation.subcounty.id,
      previous_crops: draft.previous_crops,
      soil_type: draft.soil_type,
      goal: draft.goal,
      flags: draft.flags,
      seasons: draft.seasons,
      language: locale,
      channel: "web",
    };
  };

  const queueRequest = (request: RecommendationRequest) => {
    const item = enqueueRecommendation(request);
    setQueuedId(item.id);
    showToast(t("wizard.offlineNotice"), "info");
  };

  const submit = async () => {
    if (!validateStep()) return;
    const request = buildRequest();
    if (!request) {
      navigate("/location");
      return;
    }
    setSubmitError("");
    if (!online) {
      queueRequest(request);
      return;
    }
    setSubmitting(true);
    idempotency.current = `wizard-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    try {
      const recommendation = await api.createRecommendation(
        request,
        idempotency.current,
      );
      saveLastPlan(recommendation);
      navigate(`/plan?id=${encodeURIComponent(recommendation.id)}`);
    } catch (error) {
      if (error instanceof ApiError && error.isNetworkError) {
        queueRequest(request);
      } else {
        setSubmitError(errorMessage(error, t));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const retryQueued = async () => {
    if (!queuedItem) return;
    setRetrying(true);
    setSubmitError("");
    markRecommendationAttempt(queuedItem.id);
    try {
      const recommendation = await api.createRecommendation(
        queuedItem.input,
        queuedItem.id,
      );
      removeQueuedRecommendation(queuedItem.id);
      saveLastPlan(recommendation);
      navigate(`/plan?id=${encodeURIComponent(recommendation.id)}`);
    } catch (error) {
      setSubmitError(errorMessage(error, t));
    } finally {
      setRetrying(false);
    }
  };

  if (queuedStillWaiting || queuedAndSent) {
    return (
      <div className="page container narrow">
        <PageHeader eyebrow={t("wizard.stepProgress", { current: 1, total: 3 })} title={t("wizard.title")} />
        {queuedStillWaiting ? (
          <section className="panel stack">
            <Banner tone="info" title={t("wizard.queuedTitle")}>
              {t("wizard.queuedBody")}
            </Banner>
            <p className="muted">{t("wizard.queuedHint")}</p>
            <p className="pill">{t("wizard.queuedWaiting")}</p>
            {submitError ? <Banner tone="error">{submitError}</Banner> : null}
            <div className="row">
              <Button
                onClick={() => {
                  void retryQueued();
                }}
                loading={retrying}
                loadingLabel={t("wizard.queuedNow")}
              >
                {t("wizard.queuedRetry")}
              </Button>
              <Button variant="secondary" onClick={() => navigate("/")}>
                {t("common.backHome")}
              </Button>
            </div>
          </section>
        ) : (
          <section className="panel stack">
            <Banner tone="success" title={t("wizard.queuedReady")}>
              {t("plan.offlineSaved")}
            </Banner>
            <div className="row">
              <Button onClick={() => navigate("/plan")}>{t("common.viewPlan")}</Button>
              <Button variant="secondary" onClick={() => navigate("/")}>
                {t("common.backHome")}
              </Button>
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="page container narrow">
      <PageHeader
        eyebrow={t("wizard.stepProgress", { current: Math.min(step + 1, 3), total: 3 })}
        title={t("wizard.title")}
        subtitle={t("wizard.subtitle")}
      />

      <Stepper steps={steps} current={step + 1} label={t("wizard.step", {
        current: step + 1,
        total: steps.length,
      })} />

      {!online ? <Banner tone="info">{t("wizard.offlineNotice")}</Banner> : null}
      {errorKey ? <Banner tone="error">{t(errorKey)}</Banner> : null}
      {submitError ? <Banner tone="error">{submitError}</Banner> : null}

      {step === 0 ? (
        <section className="panel stack">
          <OptionGroup
            label={t("wizard.previousCropTitle")}
            hint={t("wizard.previousCropHint")}
          >
            <div className="choiceGrid">
              {crops.map((option) => (
                <OptionCard
                  key={option.value}
                  title={option.label}
                  icon={<CropIcon code={option.value} size={28} />}
                  selected={primaryCrop === option.value}
                  onSelect={() =>
                    setDraft((current) => ({
                      ...current,
                      previous_crops: [
                        option.value,
                        ...current.previous_crops.slice(1),
                      ].filter(
                        (crop, index, list) => list.indexOf(crop) === index,
                      ) as CropCode[],
                    }))
                  }
                />
              ))}
            </div>
          </OptionGroup>

          <Field
            label={t("wizard.secondCropTitle")}
            htmlFor="second-crop"
            hint={t("wizard.secondCropHint")}
          >
            <select
              id="second-crop"
              className={selectClass(false)}
              value={secondCrop ?? ""}
              disabled={!primaryCrop}
              onChange={(event) => {
                const value = event.target.value as CropCode | "";
                if (!primaryCrop) return;
                setDraft((current) => ({
                  ...current,
                  previous_crops: value
                    ? [primaryCrop, value]
                    : current.previous_crops.slice(0, 1),
                }));
              }}
            >
              <option value="">{t("wizard.noSecondCrop")}</option>
              {crops
                .filter((option) => option.value !== primaryCrop)
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </Field>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="panel">
          <OptionGroup label={t("wizard.soilTitle")} hint={t("wizard.soilHint")}>
            <div className="choiceGrid">
              {soils.map((option) => (
                <OptionCard
                  key={option.value}
                  title={option.label}
                  hint={option.hint}
                  icon={<Icon name="leaf" size={24} />}
                  selected={draft.soil_type === option.value}
                  onSelect={() =>
                    setDraft((current) => ({ ...current, soil_type: option.value }))
                  }
                />
              ))}
            </div>
          </OptionGroup>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="panel stack">
          <OptionGroup label={t("wizard.goalTitle")} hint={t("wizard.goalHint")}>
            <div className="choiceGrid">
              {goals.map((option) => (
                <OptionCard
                  key={option.value}
                  title={option.label}
                  hint={option.hint}
                  icon={<Icon name={GOAL_ICONS[option.value] ?? "sprout"} size={24} />}
                  selected={draft.goal === option.value}
                  onSelect={() =>
                    setDraft((current) => ({ ...current, goal: option.value }))
                  }
                />
              ))}
            </div>
          </OptionGroup>

          <div>
            <h2>{t("wizard.flagsTitle")}</h2>
            <p className="muted small">{t("wizard.flagsHint")}</p>
            <div className="choiceGrid">
              {flags.map((option) => (
                <OptionCard
                  key={option.value}
                  role="checkbox"
                  title={option.label}
                  selected={draft.flags.includes(option.value)}
                  onSelect={() =>
                    setDraft((current) => ({
                      ...current,
                      flags: current.flags.includes(option.value)
                        ? current.flags.filter((flag) => flag !== option.value)
                        : [...current.flags, option.value],
                    }))
                  }
                />
              ))}
            </div>
            <p className="muted small">
              {t("wizard.flagsSelected", { count: draft.flags.length })}
            </p>
          </div>

          <details>
            <summary>{t("wizard.advanced")}</summary>
            <div className="stack" style={{ marginTop: "var(--space-3)" }}>
              <Field
                label={t("wizard.seasonsTitle")}
                htmlFor="seasons"
                hint={t("wizard.seasonsHint")}
              >
                <select
                  id="seasons"
                  className={selectClass(false)}
                  value={draft.seasons}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      seasons: Number(event.target.value),
                    }))
                  }
                >
                  {seasons.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </details>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="panel stack">
          <div>
            <h2>{t("wizard.reviewTitle")}</h2>
            <p className="muted">{t("wizard.reviewHint")}</p>
          </div>
          <dl className="summaryList">
            <div>
              <dt>{t("wizard.reviewLocation")}</dt>
              <dd>
                {resolvedLocation
                  ? `${resolvedLocation.subcounty.name}, ${resolvedLocation.district.name}`
                  : t("location.requiredTitle")}
              </dd>
            </div>
            <div>
              <dt>{t("wizard.reviewCrop")}</dt>
              <dd>{primaryCrop ? t(`common.crop.${primaryCrop}`) : t("common.unknown")}</dd>
            </div>
            <div>
              <dt>{t("wizard.reviewSecondCrop")}</dt>
              <dd>{secondCrop ? t(`common.crop.${secondCrop}`) : t("common.none")}</dd>
            </div>
            <div>
              <dt>{t("wizard.reviewSoil")}</dt>
              <dd>{draft.soil_type ? t(`common.soil.${draft.soil_type}`) : t("common.unknown")}</dd>
            </div>
            <div>
              <dt>{t("wizard.reviewGoal")}</dt>
              <dd>{draft.goal ? t(`common.goal.${draft.goal}`) : t("common.unknown")}</dd>
            </div>
            <div>
              <dt>{t("wizard.reviewSeasons")}</dt>
              <dd>{t("wizard.seasonCount", { count: draft.seasons })}</dd>
            </div>
            <div>
              <dt>{t("wizard.reviewFlags")}</dt>
              <dd>
                {draft.flags.length > 0
                  ? draft.flags.map((flag: FlagCode) => t(`common.flag.${flag}`)).join(", ")
                  : t("common.none")}
              </dd>
            </div>
          </dl>
          <Button
            onClick={() => {
              setStep(0);
            }}
            variant="secondary"
          >
            {t("wizard.changeAnswers")}
          </Button>
        </section>
      ) : null}

      <div className="row-between">
        <div className="row">
          <Button
            variant="secondary"
            onClick={step === 0 ? () => navigate("/location") : back}
            icon={<Icon name="arrow-left" size={18} />}
          >
            {t("common.back")}
          </Button>
        </div>
        {step < steps.length - 1 ? (
          <Button onClick={next} icon={<Icon name="arrow-right" size={18} />}>
            {t("common.next")}
          </Button>
        ) : (
          <Button
            size="large"
            onClick={() => {
              void submit();
            }}
            loading={submitting}
            loadingLabel={t("wizard.submitting")}
          >
            {t("wizard.submit")}
          </Button>
        )}
      </div>
    </div>
  );
};
