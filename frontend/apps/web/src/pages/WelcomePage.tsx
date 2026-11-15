import { useMemo } from "react";
import { useI18n } from "@nextcrop/i18n";
import {
  Badge,
  Button,
  CropIcon,
  Icon,
  type IconName,
} from "@nextcrop/ui";
import { Link, useNavigate } from "react-router-dom";
import { demoMode } from "../lib/api";
import { readLastPlan } from "../lib/cache";
import { resolveLocation } from "@nextcrop/api-client";

const STEPS: { titleKey: string; bodyKey: string; icon: IconName }[] = [
  { titleKey: "welcome.stepLocation", bodyKey: "welcome.stepLocationBody", icon: "pin" },
  { titleKey: "welcome.stepClimate", bodyKey: "welcome.stepClimateBody", icon: "rain" },
  { titleKey: "welcome.stepPlan", bodyKey: "welcome.stepPlanBody", icon: "leaf" },
];

export const WelcomePage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const saved = useMemo(() => readLastPlan(), []);


  const savedLocation =
    saved &&
    resolveLocation({
      lat: saved.recommendation.inputs.lat,
      lon: saved.recommendation.inputs.lon,
      district_id: saved.recommendation.inputs.district_id,
      subcounty_id: saved.recommendation.inputs.subcounty_id,
    });

  return (
    <div className="container">
      <section className="hero">
        <div>
          {demoMode ? <Badge tone="warn">{t("welcome.demoBadge")}</Badge> : null}
          <h1>{t("welcome.title")}</h1>
          <p className="lede">{t("welcome.subtitle")}</p>
          <div className="row">
            <Button
              size="large"
              icon={<Icon name="arrow-right" size={20} />}
              onClick={() => navigate("/location")}
            >
              {t("welcome.tryNow")}
            </Button>
            {saved ? (
              <Button
                variant="secondary"
                onClick={() => navigate("/plan")}
                icon={<Icon name="file" size={18} />}
              >
                {t("common.viewPlan")}
              </Button>
            ) : null}
          </div>
          <p className="muted small">{t("welcome.noAccountNeeded")}</p>
        </div>

        <aside className="heroArt" aria-hidden="true">
          <div className="heroArtRow">
            <span className="heroArtIcon">
              <Icon name="pin" size={20} />
            </span>
            <div>
              <strong>{t("welcome.stepLocation")}</strong>
              <span>{t("welcome.stepLocationBody")}</span>
            </div>
          </div>
          <div className="heroArtRow">
            <span className="heroArtIcon">
              <Icon name="rain" size={20} />
            </span>
            <div>
              <strong>{t("welcome.stepClimate")}</strong>
              <span>{t("welcome.stepClimateBody")}</span>
            </div>
          </div>
          <div className="heroArtRow">
            <span className="heroArtIcon">
              <Icon name="sprout" size={20} />
            </span>
            <div>
              <strong>{t("welcome.stepPlan")}</strong>
              <span>{t("welcome.stepPlanBody")}</span>
            </div>
          </div>
        </aside>
      </section>

      {saved && savedLocation ? (
        <section className="card">
          <div className="row-between">
            <div>
              <p className="eyebrow">{t("plan.cachedPlan")}</p>
              <h2>{t("plan.planFor", { place: savedLocation.subcounty.name })}</h2>
            </div>
            <Button variant="secondary" onClick={() => navigate("/plan")}>
              {t("common.viewPlan")}
            </Button>
          </div>
          <ul className="choiceRow" style={{ listStyle: "none", padding: 0 }}>
            {saved.recommendation.seasons.slice(0, 4).map((season) => (
              <li key={season.season_index} className="pill">
                <CropIcon code={season.crop} size={18} />
                {t(`common.crop.${season.crop}`)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2>{t("welcome.howItWorks")}</h2>
        <div className="grid3">
          {STEPS.map((step, index) => (
            <article key={step.titleKey} className="featureCard">
              <span className="featureIcon">
                <Icon name={step.icon} size={24} />
              </span>
              <h3>
                {index + 1}. {t(step.titleKey)}
              </h3>
              <p>{t(step.bodyKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="row-between">
          <div>
            <h2>{t("welcome.demoBadge")}</h2>
            <p className="muted" style={{ marginBottom: 0 }}>
              {t("welcome.demoNote")}
            </p>
          </div>
          <div className="row">
            <Link to="/sign-in" className="pill">
              {t("welcome.officerLink")}
            </Link>
            <Link to="/ussd" className="pill">
              {t("welcome.ussdLink")}
            </Link>
            <Link to="/admin" className="pill">
              {t("welcome.adminLink")}
            </Link>
          </div>
        </div>
        <p className="muted small" style={{ marginTop: "var(--space-3)", marginBottom: 0 }}>
          {t("welcome.trust")}
        </p>
      </section>
    </div>
  );
};
