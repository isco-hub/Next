import { lazy, Suspense, useMemo, useState } from "react";
import {
  containsPoint,
  findDistrict,
  findSubcounty,
  nearestSubcounty,
  resolveLocation,
  DISTRICTS,
  type GeoPoint,
} from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import {
  Banner,
  Button,
  Field,
  Icon,
  inputClass,
  selectClass,
  Skeleton,
} from "@nextcrop/ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { readLocationDraft, saveLocationDraft } from "../lib/draft";
import { usePrefs } from "../lib/prefs";

const LocationMap = lazy(() => import("../components/LocationMap"));

type MessageKey =
  | "location.gpsDenied"
  | "location.gpsUnsupported"
  | "location.gpsOutside"
  | "location.outOfRegion"
  | "location.coordinatesInvalid"
  | "location.districtRequired"
  | "location.subcountyRequired"
  | "";

export const LocationPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { lowData } = usePrefs();
  const [initial] = useState(readLocationDraft);
  const [point, setPoint] = useState<GeoPoint | null>(
    initial?.lat !== undefined && initial?.lon !== undefined
      ? { lat: initial.lat, lon: initial.lon }
      : null,
  );
  const [districtId, setDistrictId] = useState(initial?.district_id ?? "");
  const [subcountyId, setSubcountyId] = useState(initial?.subcounty_id ?? "");
  const [manualLat, setManualLat] = useState(
    initial?.lat !== undefined ? String(initial.lat) : "",
  );
  const [manualLon, setManualLon] = useState(
    initial?.lon !== undefined ? String(initial.lon) : "",
  );
  const [gpsBusy, setGpsBusy] = useState(false);
  const [message, setMessage] = useState<MessageKey>("");

  const district = findDistrict(districtId);
  const resolved = useMemo(
    () =>
      resolveLocation({
        lat: point?.lat,
        lon: point?.lon,
        district_id: districtId || undefined,
        subcounty_id: subcountyId || undefined,
      }),
    [point, districtId, subcountyId],
  );

  const selectPoint = (next: GeoPoint) => {
    const nearest = nearestSubcounty(next);
    setPoint(next);
    setDistrictId(nearest.district_id);
    setSubcountyId(nearest.id);
    setManualLat(next.lat.toFixed(4));
    setManualLon(next.lon.toFixed(4));
    setMessage("");
  };

  const handleGps = () => {
    if (!("geolocation" in navigator)) {
      setMessage("location.gpsUnsupported");
      return;
    }
    setGpsBusy(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsBusy(false);
        const next = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        if (!containsPoint(next)) {
          setMessage("location.gpsOutside");
          return;
        }
        selectPoint(next);
      },
      (error) => {
        setGpsBusy(false);
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? "location.gpsDenied"
            : "location.gpsUnsupported",
        );
      },
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  };

  const handleManual = () => {
    const lat = Number(manualLat);
    const lon = Number(manualLon);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180 ||
      manualLat.trim() === "" ||
      manualLon.trim() === ""
    ) {
      setMessage("location.coordinatesInvalid");
      return;
    }
    const next = { lat, lon };
    if (!containsPoint(next)) {
      setMessage("location.outOfRegion");
      return;
    }
    selectPoint(next);
  };

  const handleDistrict = (value: string) => {
    setDistrictId(value);
    setSubcountyId("");
    setPoint(null);
    setManualLat("");
    setManualLon("");
    setMessage("");
  };

  const handleSubcounty = (value: string) => {
    const chosen = findSubcounty(value);
    setSubcountyId(value);
    if (chosen) {
      setPoint({ lat: chosen.lat, lon: chosen.lon });
      setManualLat(String(chosen.lat));
      setManualLon(String(chosen.lon));
      setDistrictId(chosen.district_id);
    }
    setMessage("");
  };

  const handleContinue = () => {
    if (!districtId) {
      setMessage("location.districtRequired");
      return;
    }
    if (!subcountyId && !point) {
      setMessage("location.subcountyRequired");
      return;
    }
    const finalPoint =
      point ??
      (subcountyId
        ? (() => {
            const chosen = findSubcounty(subcountyId);
            return chosen ? { lat: chosen.lat, lon: chosen.lon } : null;
          })()
        : null);
    if (!finalPoint) {
      setMessage("location.subcountyRequired");
      return;
    }
    if (!containsPoint(finalPoint)) {
      setMessage("location.outOfRegion");
      return;
    }
    const nearest = subcountyId ? findSubcounty(subcountyId) : nearestSubcounty(finalPoint);
    saveLocationDraft({
      lat: finalPoint.lat,
      lon: finalPoint.lon,
      district_id: nearest?.district_id ?? districtId,
      subcounty_id: nearest?.id ?? subcountyId,
    });
    navigate("/climate");
  };

  return (
    <div className="page container">
      <PageHeader
        eyebrow={t("location.regionHint")}
        title={t("location.title")}
        subtitle={t("location.subtitle")}
      />

      {message ? (
        <Banner tone="warn" title={t("location.requiredTitle")}>
          {t(message)}
        </Banner>
      ) : null}

      <div className="row">
        <Button
          onClick={handleGps}
          loading={gpsBusy}
          loadingLabel={t("location.locating")}
          icon={<Icon name="pin" size={18} />}
        >
          {t("location.useGps")}
        </Button>
        <span className="muted small">{t("location.regionHint")}</span>
      </div>

      <section className="stack" aria-label={t("location.mapLabel")}>
        {lowData ? (
          <>
            <Banner tone="info">{t("location.lowData")}</Banner>
            <div className="mapWrap">
              <div className="mapFallback">
                <div>
                  <Icon name="map" size={32} />
                  <p className="muted">{t("location.lowData")}</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="mapWrap">
            <Suspense
              fallback={
                <div className="mapFallback">
                  <Skeleton height="12rem" width="100%" label={t("common.loading")} />
                </div>
              }
            >
              <LocationMap
                point={point}
                onPick={selectPoint}
                label={t("location.mapLabel")}
              />
            </Suspense>
            <span className="mapBadge">
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                {t("location.osmAttribution")}
              </a>
            </span>
          </div>
        )}
        <p className="muted small" style={{ marginBottom: 0 }}>
          {t("location.mapHelp")}
        </p>
      </section>

      <section className="panel stack">
        <h2>{t("location.orChoose")}</h2>
        <div className="formGrid">
          <Field label={t("location.district")} htmlFor="district" required>
            <select
              id="district"
              className={selectClass(false)}
              value={districtId}
              onChange={(event) => handleDistrict(event.target.value)}
            >
              <option value="">{t("location.chooseDistrict")}</option>
              {DISTRICTS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("location.subcounty")} htmlFor="subcounty" required>
            <select
              id="subcounty"
              className={selectClass(false)}
              value={subcountyId}
              onChange={(event) => handleSubcounty(event.target.value)}
              disabled={!district}
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

        <details>
          <summary>{t("location.manualTitle")}</summary>
          <p className="muted small">{t("location.manualHint")}</p>
          <div className="formGrid">
            <Field label={t("location.lat")} htmlFor="lat">
              <input
                id="lat"
                className={inputClass(false)}
                inputMode="decimal"
                value={manualLat}
                onChange={(event) => setManualLat(event.target.value)}
                placeholder="2.25"
              />
            </Field>
            <Field label={t("location.lon")} htmlFor="lon">
              <input
                id="lon"
                className={inputClass(false)}
                inputMode="decimal"
                value={manualLon}
                onChange={(event) => setManualLon(event.target.value)}
                placeholder="32.90"
              />
            </Field>
          </div>
          <Button variant="secondary" onClick={handleManual}>
            {t("location.check")}
          </Button>
        </details>
      </section>

      {point ? (
        <section className="panel">
          <p className="eyebrow">{t("location.confirmTitle")}</p>
          <h2>{t("location.confirmBody", {
            subcounty: resolved.subcounty.name,
            district: resolved.district.name,
          })}</h2>
          <p className="muted">
            {t("location.pinText", {
              lat: point.lat.toFixed(3),
              lon: point.lon.toFixed(3),
            })}
          </p>
          <p className="pill">{t("location.gridCell", { cell: resolved.grid_cell_id })}</p>
        </section>
      ) : null}

      <div className="row">
        <Button
          size="large"
          onClick={handleContinue}
          icon={<Icon name="arrow-right" size={20} />}
        >
          {t("location.useThisLocation")}
        </Button>
      </div>
    </div>
  );
};
