import { useMemo, useState } from "react";
import {
  DISTRICTS,
  findDistrict,
  findSubcounty,
  resolveLocation,
  type CropCode,
  type Plot,
  type SoilType,
} from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banner,
  Button,
  CropIcon,
  EmptyState,
  Field,
  Icon,
  Sheet,
  inputClass,
  selectClass,
} from "@nextcrop/ui";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { LoadingPanel, QueryErrorState } from "../components/PageState";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { readLastPlan } from "../lib/cache";
import {
  readLocationDraft,
  saveLocationDraft,
  saveWizardDraft,
} from "../lib/draft";
import { errorMessage } from "../lib/errors";
import { cropOptions, soilOptions } from "../lib/options";
import { useOnline } from "../lib/online";
import { useToast } from "../lib/toast";

interface PlotForm {
  name: string;
  size: string;
  soil: SoilType;
  crop: CropCode;
  districtId: string;
  subcountyId: string;
  lat: number | null;
  lon: number | null;
}

const makeForm = (
  location: ReturnType<typeof resolveLocation>,
  plot: Plot | null,
  defaultName: string,
): PlotForm => {
  if (plot) {
    const resolved = resolveLocation({
      lat: plot.lat,
      lon: plot.lon,
      district_id: plot.district_id,
      subcounty_id: plot.subcounty_id,
    });
    return {
      name: plot.name,
      size: String(plot.size_acres),
      soil: plot.soil_type,
      crop: plot.previous_crops[0] ?? "maize",
      districtId: resolved.district.id,
      subcountyId: resolved.subcounty.id,
      lat: plot.lat,
      lon: plot.lon,
    };
  }
  return {
    name: defaultName,
    size: "1",
    soil: "loam",
    crop: "maize",
    districtId: location.district.id,
    subcountyId: location.subcounty.id,
    lat: location.point.lat,
    lon: location.point.lon,
  };
};

export const PlotsPage = () => {
  const { t, locale, formatDate, formatNumber } = useI18n();
  const { user } = useAuth();
  const { showToast } = useToast();
  const online = useOnline();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const fromPlan = searchParams.get("fromPlan");
  const [lastPlan] = useState(readLastPlan);
  const [draftLocation] = useState(readLocationDraft);

  const initialLocation = useMemo(() => {
    if (draftLocation) {
      return resolveLocation(draftLocation);
    }
    if (lastPlan) {
      return resolveLocation({
        lat: lastPlan.recommendation.inputs.lat,
        lon: lastPlan.recommendation.inputs.lon,
        district_id: lastPlan.recommendation.inputs.district_id,
        subcounty_id: lastPlan.recommendation.inputs.subcounty_id,
      });
    }
    return resolveLocation({ district_id: "lira" });
  }, [draftLocation, lastPlan]);

  const [sheetOpen, setSheetOpen] = useState(Boolean(fromPlan));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlotForm>(() =>
    makeForm(
      initialLocation,
      null,
      lastPlan
        ? t("plan.planFor", { place: initialLocation.subcounty.name })
        : "",
    ),
  );
  const [formError, setFormError] = useState("");
  const [saveError, setSaveError] = useState("");

  const plotsQuery = useQuery({
    queryKey: ["plots", user?.id],
    queryFn: () => api.listPlots(),
    enabled: Boolean(user),
  });

  const historyQuery = useQuery({
    queryKey: ["recommendations", user?.id],
    queryFn: () => api.listRecommendations(),
    enabled: Boolean(user),
  });

  const crops = cropOptions(t);
  const soils = soilOptions(t);
  const plots = plotsQuery.data ?? [];
  const atLimit = plots.length >= 5;
  const district = findDistrict(form.districtId);

  const saveMutation = useMutation({
    mutationFn: (input: {
      id: string | null;
      payload: Parameters<typeof api.createPlot>[0];
    }) =>
      input.id
        ? api.updatePlot(input.id, input.payload)
        : api.createPlot(input.payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["plots"] });
      showToast(t("plots.plotSaved"), "success");
      setSheetOpen(false);
      setSaveError("");
    },
    onError: (error) => setSaveError(errorMessage(error, t)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePlot(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["plots"] });
      showToast(t("plots.plotDeleted"), "success");
    },
    onError: (error) => setSaveError(errorMessage(error, t)),
  });

  const openNew = () => {
    setEditingId(null);
    setForm(
      makeForm(initialLocation, null, lastPlan ? t("plan.goToPlots") : ""),
    );
    setFormError("");
    setSaveError("");
    setSheetOpen(true);
  };

  const openEdit = (plot: Plot) => {
    setEditingId(plot.id);
    setForm(makeForm(initialLocation, plot, plot.name));
    setFormError("");
    setSaveError("");
    setSheetOpen(true);
  };

  const handleDistrict = (value: string) => {
    setForm((current) => ({
      ...current,
      districtId: value,
      subcountyId: "",
      lat: null,
      lon: null,
    }));
  };

  const handleSubcounty = (value: string) => {
    const chosen = findSubcounty(value);
    setForm((current) => ({
      ...current,
      subcountyId: value,
      lat: chosen?.lat ?? null,
      lon: chosen?.lon ?? null,
    }));
  };

  const submit = () => {
    const size = Number(form.size);
    if (!form.name.trim()) {
      setFormError(t("plots.nameRequired"));
      return;
    }
    if (!Number.isFinite(size) || size < 0.1 || size > 100) {
      setFormError(t("plots.sizeInvalid"));
      return;
    }
    if (form.lat === null || form.lon === null || !form.subcountyId) {
      setFormError(t("plots.locationRequired"));
      return;
    }
    if (!online) {
      setSaveError(t("plots.offlineSave"));
      return;
    }
    saveMutation.mutate({
      id: editingId,
      payload: {
        name: form.name.trim(),
        lat: form.lat,
        lon: form.lon,
        soil_type: form.soil,
        size_acres: size,
        previous_crops: [form.crop],
        district_id: form.districtId,
        subcounty_id: form.subcountyId,
      },
    });
  };

  const applyPlot = (plot: Plot) => {
    saveLocationDraft({
      lat: plot.lat,
      lon: plot.lon,
      district_id: plot.district_id,
      subcounty_id: plot.subcounty_id,
    });
    saveWizardDraft({
      previous_crops: plot.previous_crops,
      soil_type: plot.soil_type,
      goal: null,
      flags: [],
      seasons: 4,
      language: locale,
    });
    navigate("/wizard");
  };

  return (
    <div className="page container">
      <PageHeader
        eyebrow={t("plots.maxPlots", { count: plots.length })}
        title={t("plots.title")}
        subtitle={t("plots.subtitle")}
        actions={
          <Button
            onClick={openNew}
            disabled={atLimit}
            icon={<Icon name="plus" size={18} />}
          >
            {t("plots.addPlot")}
          </Button>
        }
      />

      {!online ? <Banner tone="info">{t("plots.offlineSave")}</Banner> : null}
      {atLimit ? (
        <Banner tone="warn" title={t("plots.limitTitle")}>
          {t("plots.limitBody")}
        </Banner>
      ) : null}
      {saveError ? <Banner tone="error">{saveError}</Banner> : null}

      {plotsQuery.isLoading ? (
        <LoadingPanel label={t("common.loading")} />
      ) : null}

      {plotsQuery.isError ? (
        <QueryErrorState
          error={plotsQuery.error}
          onRetry={() => void plotsQuery.refetch()}
        />
      ) : null}

      {plotsQuery.isSuccess && plots.length === 0 ? (
        <EmptyState
          icon="map"
          title={t("plots.emptyTitle")}
          body={t("plots.emptyBody")}
          action={
            <Button onClick={openNew} icon={<Icon name="plus" size={18} />}>
              {t("plots.addPlot")}
            </Button>
          }
        />
      ) : null}

      {plots.length > 0 ? (
        <div className="listCards">
          {plots.map((plot) => {
            const resolved = resolveLocation({
              lat: plot.lat,
              lon: plot.lon,
              district_id: plot.district_id,
              subcounty_id: plot.subcounty_id,
            });
            return (
              <article key={plot.id} className="card stack">
                <div className="row-between">
                  <div>
                    <h2 style={{ marginBottom: "0.1rem" }}>{plot.name}</h2>
                    <p className="muted small" style={{ marginBottom: 0 }}>
                      {resolved.subcounty.name}, {resolved.district.name}
                    </p>
                  </div>
                  <span className="pill">
                    {t("plots.acresValue", {
                      count: formatNumber(plot.size_acres, {
                        maximumFractionDigits: 1,
                      }),
                    })}
                  </span>
                </div>
                <dl className="infoGrid">
                  <div>
                    <dt>{t("plots.soil")}</dt>
                    <dd>{t(`common.soil.${plot.soil_type}`)}</dd>
                  </div>
                  <div>
                    <dt>{t("plots.previousCrop")}</dt>
                    <dd>
                      {plot.previous_crops[0]
                        ? t(`common.crop.${plot.previous_crops[0]}`)
                        : t("common.unknown")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("plots.lastUpdated")}</dt>
                    <dd>{formatDate(plot.updated_at)}</dd>
                  </div>
                </dl>
                <div className="row">
                  <Button size="small" onClick={() => applyPlot(plot)}>
                    {t("plots.usePlot")}
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => openEdit(plot)}
                    icon={<Icon name="edit" size={16} />}
                  >
                    {t("common.edit")}
                  </Button>
                  <Button
                    size="small"
                    variant="dangerGhost"
                    disabled={!online || deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(t("plots.deleteConfirm", { name: plot.name }))) {
                        deleteMutation.mutate(plot.id);
                      }
                    }}
                    icon={<Icon name="trash" size={16} />}
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <section className="panel stack">
        <div className="row-between">
          <div>
            <h2>{t("plots.historyTitle")}</h2>
            <p className="muted small" style={{ marginBottom: 0 }}>
              {t("plan.traceNote")}
            </p>
          </div>
          <Button
            variant="secondary"
            size="small"
            onClick={() => void historyQuery.refetch()}
            icon={<Icon name="refresh" size={16} />}
          >
            {t("common.refresh")}
          </Button>
        </div>
        {historyQuery.isLoading ? <LoadingPanel label={t("common.loading")} /> : null}
        {historyQuery.isError ? (
          <QueryErrorState
            error={historyQuery.error}
            onRetry={() => void historyQuery.refetch()}
          />
        ) : null}
        {historyQuery.isSuccess && (historyQuery.data ?? []).length === 0 ? (
          <p className="muted">{t("plots.noHistory")}</p>
        ) : null}
        {(historyQuery.data ?? []).length > 0 ? (
          <ul className="listReset">
            {historyQuery.data?.map((summary) => (
              <li key={summary.id} className="listRow">
                <div>
                  <strong>
                    {t("plots.planFrom", { date: formatDate(summary.created_at) })}
                  </strong>
                  <p className="muted small" style={{ marginBottom: 0 }}>
                    {summary.crops.map((crop) => t(`common.crop.${crop}`)).join(" · ")}
                  </p>
                </div>
                <div className="row">
                  <span className="pill">
                    {t("plan.packVersion", { version: summary.pack_version })}
                  </span>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => navigate(`/plan?id=${encodeURIComponent(summary.id)}`)}
                  >
                    {t("plots.view")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingId ? t("plots.editPlot") : t("plots.addPlot")}
        closeLabel={t("common.closeDialog")}
        footer={
          <div className="row-between">
            <Button variant="secondary" onClick={() => setSheetOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={submit}
              loading={saveMutation.isPending}
              loadingLabel={t("common.submitting")}
            >
              {t("plots.savePlot")}
            </Button>
          </div>
        }
      >
        <div className="stack">
          {formError ? <Banner tone="error">{formError}</Banner> : null}
          {saveError ? <Banner tone="error">{saveError}</Banner> : null}
          <Field label={t("plots.plotName")} htmlFor="plot-name" required>
            <input
              id="plot-name"
              className={inputClass(false)}
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder={t("plots.plotNamePlaceholder")}
            />
          </Field>
          <div className="formGrid">
            <Field label={t("plots.sizeAcres")} htmlFor="plot-size" required>
              <input
                id="plot-size"
                className={inputClass(false)}
                inputMode="decimal"
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={form.size}
                onChange={(event) =>
                  setForm((current) => ({ ...current, size: event.target.value }))
                }
              />
            </Field>
            <Field label={t("plots.soil")} htmlFor="plot-soil" required>
              <select
                id="plot-soil"
                className={selectClass(false)}
                value={form.soil}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    soil: event.target.value as SoilType,
                  }))
                }
              >
                {soils.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("plots.previousCrop")} htmlFor="plot-crop" required>
              <select
                id="plot-crop"
                className={selectClass(false)}
                value={form.crop}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    crop: event.target.value as CropCode,
                  }))
                }
              >
                {crops.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <h3>{t("plots.addLocation")}</h3>
            <div className="formGrid">
              <Field label={t("location.district")} htmlFor="plot-district" required>
                <select
                  id="plot-district"
                  className={selectClass(false)}
                  value={form.districtId}
                  onChange={(event) => handleDistrict(event.target.value)}
                >
                  {DISTRICTS.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={t("location.subcounty")}
                htmlFor="plot-subcounty"
                required
              >
                <select
                  id="plot-subcounty"
                  className={selectClass(false)}
                  value={form.subcountyId}
                  onChange={(event) => handleSubcounty(event.target.value)}
                >
                  <option value="">{t("location.chooseSubcounty")}</option>
                  {district?.subcounties.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="muted small">{t("officer.locationHint")}</p>
          </div>

          <div className="row alignCenter">
            <CropIcon code={form.crop} size={24} />
            <span className="muted small">{t("plots.usePlotHint")}</span>
          </div>
        </div>
      </Sheet>
    </div>
  );
};
