import { useMemo, useState } from "react";
import {
  DISTRICTS,
  findSubcounty,
  type AssistedRegistrationInput,
  type CropCode,
  type SoilType,
  type Subcounty,
} from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banner,
  Button,
  CropIcon,
  Field,
  Icon,
  StatCard,
  StatGrid,
  inputClass,
  selectClass,
  textareaClass,
} from "@nextcrop/ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { LoadingPanel, QueryErrorState } from "../components/PageState";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/errors";
import { cropOptions, soilOptions } from "../lib/options";
import { useToast } from "../lib/toast";

export const OfficerPage = () => {
  const { t, formatDate, formatNumber } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const subcountyChoices = useMemo<Subcounty[]>(() => {
    const assigned = (user?.subcounty_ids ?? [])
      .map((id) => findSubcounty(id))
      .filter((entry): entry is Subcounty => Boolean(entry));
    if (assigned.length > 0) return assigned;
    return [...(DISTRICTS[0]?.subcounties ?? [])];
  }, [user]);

  const [selected, setSelected] = useState(subcountyChoices[0]?.id ?? "");
  const [farmerName, setFarmerName] = useState("");
  const [farmerPhone, setFarmerPhone] = useState("");
  const [plotName, setPlotName] = useState("");
  const [size, setSize] = useState("1");
  const [soil, setSoil] = useState<SoilType>("loam");
  const [crop, setCrop] = useState<CropCode>("maize");
  const [lat, setLat] = useState(String(subcountyChoices[0]?.lat ?? ""));
  const [lon, setLon] = useState(String(subcountyChoices[0]?.lon ?? ""));
  const [consent, setConsent] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registeredRef, setRegisteredRef] = useState("");
  const [pest, setPest] = useState("");
  const [disease, setDisease] = useState("");
  const [note, setNote] = useState("");
  const [observationError, setObservationError] = useState("");
  const [message, setMessage] = useState("");
  const [smsError, setSmsError] = useState("");
  const [smsResult, setSmsResult] = useState("");

  const crops = cropOptions(t);
  const soils = soilOptions(t);
  const selectedSubcounty = findSubcounty(selected);

  const summaryQuery = useQuery({
    queryKey: ["officerSummary", selected],
    queryFn: () => api.getOfficerSummary(selected || undefined),
    enabled: Boolean(selected),
  });

  const observationsQuery = useQuery({
    queryKey: ["observations", user?.id],
    queryFn: () => api.listObservations(),
  });

  const registerMutation = useMutation({
    mutationFn: (input: AssistedRegistrationInput) => api.assistedRegistration(input),
    onSuccess: (result) => {
      setRegisteredRef(result.farmer_ref);
      setRegisterError("");
      setFarmerName("");
      setFarmerPhone("");
      setPlotName("");
      setConsent(false);
      showToast(t("officer.registered"), "success");
      void queryClient.invalidateQueries({ queryKey: ["officerSummary"] });
    },
    onError: (error) => setRegisterError(errorMessage(error, t)),
  });

  const observationMutation = useMutation({
    mutationFn: () =>
      api.createObservation({
        crop_planted: crop,
        pest_sighting: pest || undefined,
        disease_sighting: disease || undefined,
        note: note || undefined,
      }),
    onSuccess: () => {
      setObservationError("");
      setPest("");
      setDisease("");
      setNote("");
      showToast(t("officer.observationSaved"), "success");
      void queryClient.invalidateQueries({ queryKey: ["observations"] });
    },
    onError: (error) => setObservationError(errorMessage(error, t)),
  });

  const smsMutation = useMutation({
    mutationFn: () =>
      api.sendBulkSms({
        subcounty_id: selected,
        message,
        language: "en",
      }),
    onSuccess: (result) => {
      setSmsError("");
      setSmsResult(
        t("officer.smsSent", { count: result.recipients }) +
          ` · ${result.encoding} · ${result.segments_per_message}`,
      );
      setMessage("");
    },
    onError: (error) => setSmsError(errorMessage(error, t)),
  });

  const chooseSubcounty = (value: string) => {
    setSelected(value);
    const chosen = findSubcounty(value);
    if (chosen) {
      setLat(String(chosen.lat));
      setLon(String(chosen.lon));
    }
  };

  const submitRegistration = () => {
    const sizeValue = Number(size);
    if (
      !farmerName.trim() ||
      farmerPhone.replace(/\D/g, "").length < 9 ||
      !plotName.trim() ||
      !Number.isFinite(sizeValue) ||
      sizeValue < 0.1 ||
      sizeValue > 100 ||
      !Number.isFinite(Number(lat)) ||
      !Number.isFinite(Number(lon))
    ) {
      setRegisterError(t("officer.invalidFarmer"));
      return;
    }
    if (!consent) {
      setRegisterError(t("auth.consentNeeded"));
      return;
    }
    setRegisterError("");
    registerMutation.mutate({
      farmer_name: farmerName.trim(),
      phone: farmerPhone,
      language: "en",
      subcounty_id: selected,
      consent: true,
      plot: {
        name: plotName.trim(),
        lat: Number(lat),
        lon: Number(lon),
        soil_type: soil,
        size_acres: sizeValue,
        previous_crops: [crop],
      },
    });
  };

  const submitObservation = () => {
    if (!crop) return;
    observationMutation.mutate();
  };

  const submitSms = () => {
    if (!message.trim()) {
      setSmsError(t("officer.messageRequired"));
      return;
    }
    setSmsResult("");
    smsMutation.mutate();
  };

  const summary = summaryQuery.data;
  const onsetLabel = summary
    ? {
        not_started: t("climate.onsetNotStarted"),
        onset_detected: t("climate.onsetDetected"),
        false_start_risk: t("climate.onsetFalseStart"),
        unknown: t("climate.onsetUnknown"),
      }[summary.onset_status]
    : "";

  return (
    <div className="page container">
      <PageHeader
        eyebrow={t("officer.scope")}
        title={t("officer.title")}
        subtitle={t("officer.subtitle")}
        actions={
          <>
            <Field label={t("officer.subcounty")} htmlFor="officer-subcounty">
              <select
                id="officer-subcounty"
                className={selectClass(false)}
                value={selected}
                onChange={(event) => chooseSubcounty(event.target.value)}
              >
                {subcountyChoices.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              variant="secondary"
              onClick={() => navigate("/reports")}
              icon={<Icon name="chart" size={18} />}
            >
              {t("officer.reportsTitle")}
            </Button>
          </>
        }
      />

      <p className="pill">{t("officer.demoScope")}</p>

      {summaryQuery.isLoading ? <LoadingPanel label={t("common.loading")} /> : null}
      {summaryQuery.isError ? (
        <QueryErrorState
          error={summaryQuery.error}
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : null}

      {summary ? (
        <section className="stack">
          <StatGrid>
            <StatCard
              label={t("officer.farmers")}
              value={formatNumber(summary.farmers_count)}
              hint={summary.subcounty_name}
            />
            <StatCard
              label={t("officer.moisture")}
              value={t(`common.moisture.${summary.moisture_class}`)}
            />
            <StatCard label={t("officer.onset")} value={onsetLabel} />
            <StatCard
              label={t("officer.updatedLabel")}
              value={formatDate(summary.updated_at)}
            />
          </StatGrid>
          {summary.suppressed ? (
            <Banner tone="warn">{t("officer.suppressed")}</Banner>
          ) : null}
          <div className="panel stack">
            <h2>{t("officer.topCrops")}</h2>
            {summary.recommended_crops.length === 0 ? (
              <p className="muted">{t("officer.noData")}</p>
            ) : (
              <div className="choiceRow">
                {summary.recommended_crops.map((entry) => (
                  <span key={entry.crop} className="pill">
                    <CropIcon code={entry.crop} size={18} />
                    {t(`common.crop.${entry.crop}`)} · {formatNumber(entry.count)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      <div className="grid2">
        <section className="panel stack">
          <div>
            <h2>{t("officer.assistedTitle")}</h2>
            <p className="muted small">{t("officer.assistedIntro")}</p>
          </div>
          {registeredRef ? (
            <Banner tone="success" title={t("officer.registered")}>
              {t("officer.registeredBody", { ref: registeredRef })}
            </Banner>
          ) : null}
          {registerError ? <Banner tone="error">{registerError}</Banner> : null}
          <div className="formGrid">
            <Field label={t("officer.farmerName")} htmlFor="farmer-name" required>
              <input
                id="farmer-name"
                className={inputClass(false)}
                value={farmerName}
                onChange={(event) => setFarmerName(event.target.value)}
              />
            </Field>
            <Field label={t("officer.farmerPhone")} htmlFor="farmer-phone" required>
              <input
                id="farmer-phone"
                className={inputClass(false)}
                type="tel"
                inputMode="tel"
                value={farmerPhone}
                onChange={(event) => setFarmerPhone(event.target.value)}
              />
            </Field>
            <Field label={t("officer.plotName")} htmlFor="farmer-plot" required>
              <input
                id="farmer-plot"
                className={inputClass(false)}
                value={plotName}
                onChange={(event) => setPlotName(event.target.value)}
              />
            </Field>
            <Field label={t("officer.sizeAcres")} htmlFor="farmer-size" required>
              <input
                id="farmer-size"
                className={inputClass(false)}
                type="number"
                inputMode="decimal"
                min="0.1"
                step="0.1"
                value={size}
                onChange={(event) => setSize(event.target.value)}
              />
            </Field>
            <Field label={t("officer.soil")} htmlFor="farmer-soil">
              <select
                id="farmer-soil"
                className={selectClass(false)}
                value={soil}
                onChange={(event) => setSoil(event.target.value as SoilType)}
              >
                {soils.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("officer.lastCrop")} htmlFor="farmer-crop">
              <select
                id="farmer-crop"
                className={selectClass(false)}
                value={crop}
                onChange={(event) => setCrop(event.target.value as CropCode)}
              >
                {crops.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("officer.lat")} htmlFor="farmer-lat">
              <input
                id="farmer-lat"
                className={inputClass(false)}
                inputMode="decimal"
                value={lat}
                onChange={(event) => setLat(event.target.value)}
              />
            </Field>
            <Field label={t("officer.lon")} htmlFor="farmer-lon">
              <input
                id="farmer-lon"
                className={inputClass(false)}
                inputMode="decimal"
                value={lon}
                onChange={(event) => setLon(event.target.value)}
              />
            </Field>
          </div>
          <p className="muted small">{t("officer.locationHint")}</p>
          <label className="row" htmlFor="officer-consent">
            <input
              id="officer-consent"
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>{t("officer.assistedConsentBody")}</span>
          </label>
          <Button
            onClick={submitRegistration}
            loading={registerMutation.isPending}
            loadingLabel={t("officer.registering")}
            icon={<Icon name="users" size={18} />}
          >
            {t("officer.register")}
          </Button>
        </section>

        <section className="panel stack">
          <div>
            <h2>{t("officer.observationsTitle")}</h2>
            <p className="muted small">{t("officer.observationsIntro")}</p>
          </div>
          {observationError ? <Banner tone="error">{observationError}</Banner> : null}
          <Field label={t("officer.cropPlanted")} htmlFor="obs-crop">
            <select
              id="obs-crop"
              className={selectClass(false)}
              value={crop}
              onChange={(event) => setCrop(event.target.value as CropCode)}
            >
              {crops.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("officer.pest")} htmlFor="obs-pest">
            <input
              id="obs-pest"
              className={inputClass(false)}
              placeholder={t("officer.pestPlaceholder")}
              value={pest}
              onChange={(event) => setPest(event.target.value)}
            />
          </Field>
          <Field label={t("officer.disease")} htmlFor="obs-disease">
            <input
              id="obs-disease"
              className={inputClass(false)}
              placeholder={t("officer.diseasePlaceholder")}
              value={disease}
              onChange={(event) => setDisease(event.target.value)}
            />
          </Field>
          <Field label={t("officer.note")} htmlFor="obs-note">
            <textarea
              id="obs-note"
              className={textareaClass(false)}
              rows={3}
              placeholder={t("officer.notePlaceholder")}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <Button
            onClick={submitObservation}
            loading={observationMutation.isPending}
            icon={<Icon name="plus" size={18} />}
          >
            {t("officer.saveObservation")}
          </Button>

          {observationsQuery.isLoading ? <LoadingPanel /> : null}
          {observationsQuery.isError ? (
            <Banner tone="error">{errorMessage(observationsQuery.error, t)}</Banner>
          ) : null}
          {observationsQuery.isSuccess && (observationsQuery.data ?? []).length === 0 ? (
            <p className="muted">{t("officer.observationsEmpty")}</p>
          ) : null}
          <ul className="listReset">
            {(observationsQuery.data ?? []).slice(0, 5).map((observation) => (
              <li key={observation.id} className="listRow">
                <div>
                  <strong>{t(`common.crop.${observation.crop_planted}`)}</strong>
                  <p className="muted small" style={{ marginBottom: 0 }}>
                    {[observation.pest_sighting, observation.disease_sighting]
                      .filter(Boolean)
                      .join(" · ") || t("common.none")}
                  </p>
                </div>
                <span className="small muted">
                  {formatDate(observation.observed_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel stack">
        <div>
          <h2>{t("officer.bulkTitle")}</h2>
          <p className="muted small">{t("officer.bulkIntro")}</p>
        </div>
        {smsResult ? <Banner tone="success">{smsResult}</Banner> : null}
        {smsError ? <Banner tone="error">{smsError}</Banner> : null}
        <Field label={t("officer.message")} htmlFor="bulk-message">
          <textarea
            id="bulk-message"
            className={textareaClass(false)}
            rows={3}
            maxLength={480}
            placeholder={t("officer.messagePlaceholder")}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </Field>
        <div className="row-between">
          <div className="row">
            <span className="pill">
              {t("officer.recipients")}:{" "}
              {formatNumber(summary?.farmers_count ?? 0)}
            </span>
            <span className="pill">{t("common.characters", { count: message.length })}</span>
            {selectedSubcounty ? (
              <span className="pill">{selectedSubcounty.name}</span>
            ) : null}
          </div>
          <Button
            onClick={submitSms}
            loading={smsMutation.isPending}
            loadingLabel={t("common.submitting")}
            icon={<Icon name="send" size={18} />}
          >
            {t("officer.sendSms")}
          </Button>
        </div>
      </section>
    </div>
  );
};
