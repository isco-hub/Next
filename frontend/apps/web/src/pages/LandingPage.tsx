import { useI18n } from "@nextcrop/i18n";
import { Badge, Button, CropIcon, Icon } from "@nextcrop/ui";
import { useNavigate } from "react-router-dom";
import { demoMode } from "../lib/api";
import s from "./LandingPage.module.css";

/* ── static data ─────────────────────────────────────────────────────── */

const TRUST = [
  { icon: "leaf"   as const, label: "NASA satellite data" },
  { icon: "shield" as const, label: "Agronomist-reviewed rules" },
  { icon: "lock"   as const, label: "Private by design" },
  { icon: "wifi"   as const, label: "Works on 2G & offline" },
  { icon: "globe"  as const, label: "English & Leb Lango" },
];

const STEPS = [
  {
    num: "1",
    icon: "pin"     as const,
    titleKey: "welcome.stepLocation",
    bodyKey:  "welcome.stepLocationBody",
  },
  {
    num: "2",
    icon: "rain"    as const,
    titleKey: "welcome.stepClimate",
    bodyKey:  "welcome.stepClimateBody",
  },
  {
    num: "3",
    icon: "sparkle" as const,
    titleKey: "welcome.stepPlan",
    bodyKey:  "welcome.stepPlanBody",
  },
];

const STATS = [
  { val: "30",  suffix: "-day",      label: "Satellite rainfall window" },
  { val: "6",   suffix: " crops",    label: "Rotation families covered" },
  { val: "2G",  suffix: "",          label: "Works on low-bandwidth networks" },
  { val: "2",   suffix: " languages",label: "English and Leb Lango" },
];

const FEATURES = [
  {
    icon: "rain"    as const,
    color: "iconBlue"  as const,
    title: "Real satellite climate data",
    body:  "30-day rainfall against normal, soil moisture class and season onset — from NASA POWER and SMAP, updated regularly.",
    chip:  "NASA POWER · SMAP",
  },
  {
    icon: "leaf"    as const,
    color: "iconGreen" as const,
    title: "Honest uncertainty",
    body:  "Every plan shows a confidence level, data age and a clear disclaimer. We never overclaim what satellite data can tell you about your field.",
    chip:  "Confidence badge",
  },
  {
    icon: "sparkle" as const,
    color: "iconAmber" as const,
    title: "What-if scenarios",
    body:  "Change your goal or add a warning flag — striga, armyworm, low fertility — and instantly see how the rotation plan changes.",
    chip:  "Interactive",
  },
  {
    icon: "wifi"    as const,
    color: "iconGreen" as const,
    title: "Works without internet",
    body:  "Your last plan is cached on your phone. Submit the form offline and it sends automatically when you reconnect.",
    chip:  "Offline-first PWA",
  },
  {
    icon: "phone"   as const,
    color: "iconBlue"  as const,
    title: "USSD for any phone",
    body:  "Farmers without smartphones access the same advice through a USSD session on any mobile network.",
    chip:  "No smartphone needed",
  },
  {
    icon: "users"   as const,
    color: "iconAmber" as const,
    title: "Extension officer tools",
    body:  "Officers register farmers, capture field observations, send bulk SMS advisories and view sub-county summaries.",
    chip:  "Officer dashboard",
  },
];

const QUOTES = [
  {
    text:     "The plan told me to plant cowpea after maize because of striga. I followed it and the striga was much less the next season.",
    name:     "Akello Grace",
    role:     "Smallholder farmer, Lira District",
    initials: "AG",
    stars:    5,
  },
  {
    text:     "I use the officer dashboard to register farmers and send bulk SMS before the planting window. It saves me two days of travel every season.",
    name:     "Okello James",
    role:     "Extension Officer, Otuke",
    initials: "OJ",
    stars:    5,
  },
  {
    text:     "The confidence badge and data age label matter. Farmers trust the advice more when they can see it is honest about what it does not know.",
    name:     "Dr. Amoding Sarah",
    role:     "Agronomist, Makerere University",
    initials: "AS",
    stars:    5,
  },
];

const CTA_CARDS = [
  { icon: "sprout" as const, text: "Free rotation plan in 3 minutes" },
  { icon: "lock"   as const, text: "No account needed to try" },
  { icon: "phone"  as const, text: "Works on any Android phone" },
];

/* ── helpers ─────────────────────────────────────────────────────────── */

const iconColorClass = (c: "iconGreen" | "iconAmber" | "iconBlue" | "iconRed") =>
  s[c] ?? s.iconGreen;

/* ── component ───────────────────────────────────────────────────────── */

export const LandingPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div>

      {/* ══════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════ */}
      <section className={s.hero} aria-labelledby="lp-hero-h">
        <div className={s.heroBg} aria-hidden="true">
          <div className={s.heroBgBlob1} />
          <div className={s.heroBgBlob2} />
          <div className={s.heroBgGrid} />
        </div>

        <div className={`container ${s.heroInner}`}>

          {/* left: copy */}
          <div className={s.heroContent}>
            {demoMode ? (
              <Badge tone="warn">{t("welcome.demoBadge")}</Badge>
            ) : (
              <div className={s.heroPill}>
                <span className={s.heroPillDot} aria-hidden="true" />
                Live · Lango sub-region, Uganda
              </div>
            )}

            <h1 id="lp-hero-h" className={s.heroHeading}>
              Know what to plant{" "}
              <span className={s.heroAccent}>next season</span>
            </h1>

            <p className={s.heroSub}>
              A free crop rotation plan for smallholder farmers in Lango.
              Three questions. Real satellite data. A plan with reasons —
              in your language.
            </p>

            <div className={s.heroCtas}>
              <Button
                size="large"
                onClick={() => navigate("/location")}
                icon={<Icon name="arrow-right" size={20} />}
              >
                {t("welcome.tryNow")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate("/ussd")}
                icon={<Icon name="phone" size={18} />}
              >
                See USSD demo
              </Button>
            </div>

            <div className={s.heroMeta}>
              {[
                { icon: "lock"   as const, text: t("welcome.noAccountNeeded") },
                { icon: "shield" as const, text: "Agronomist-reviewed rules" },
              ].map((m) => (
                <span key={m.text} className={s.heroMetaItem}>
                  <span className={s.heroMetaIcon} aria-hidden="true">
                    <Icon name={m.icon} size={14} />
                  </span>
                  {m.text}
                </span>
              ))}
            </div>
          </div>

          {/* right: mock data cards */}
          <div className={s.heroVisual} aria-hidden="true">
            <div className={s.heroCard}>
              <div className={`${s.heroCardIcon} ${s.iconBlue}`}>
                <Icon name="rain" size={22} />
              </div>
              <div className={s.heroCardBody}>
                <span className={s.heroCardEye}>30-day rainfall</span>
                <span className={s.heroCardVal}>87 mm · Drier than usual</span>
                <span className={s.heroCardSub}>Updated 4 h ago · NASA POWER</span>
              </div>
            </div>

            <div className={s.heroCard}>
              <div className={`${s.heroCardIcon} ${s.iconGreen}`}>
                <CropIcon code="cowpea" size={22} />
              </div>
              <div className={s.heroCardBody}>
                <span className={s.heroCardEye}>Season A · recommended</span>
                <span className={s.heroCardVal}>Cowpea · High confidence</span>
                <span className={s.heroCardSub}>Legumes feed soil after maize</span>
              </div>
            </div>

            <div className={s.heroCard}>
              <div className={`${s.heroCardIcon} ${s.iconAmber}`}>
                <Icon name="shield" size={22} />
              </div>
              <div className={s.heroCardBody}>
                <span className={s.heroCardEye}>Rule pack</span>
                <span className={s.heroCardVal}>v2024-A · 6 golden tests passed</span>
                <span className={s.heroCardSub}>Reviewed by agronomist</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          TRUST BAR
      ══════════════════════════════════════════════════════════ */}
      <div className={s.trustBar}>
        <div className={`container ${s.trustRow}`}>
          {TRUST.map((item) => (
            <div key={item.label} className={s.trustItem}>
              <span className={s.trustIcon} aria-hidden="true">
                <Icon name={item.icon} size={15} />
              </span>
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════════ */}
      <section className={s.section} aria-labelledby="lp-steps-h">
        <div className="container">
          <div className={s.sectionHead}>
            <span className={s.eyebrow}>How it works</span>
            <h2 id="lp-steps-h" className={s.sectionTitle}>
              {t("welcome.howItWorks")}
            </h2>
            <p className={s.sectionSub}>
              Three short questions. Under three minutes. A plan you can read offline.
            </p>
          </div>

          <div className={s.stepsWrap}>
            {STEPS.map((step) => (
              <div key={step.num} className={s.stepCard}>
                <div className={s.stepNum} aria-hidden="true">{step.num}</div>
                <div className={s.stepIconBox} aria-hidden="true">
                  <Icon name={step.icon} size={24} />
                </div>
                <h3 className={s.stepTitle}>{t(step.titleKey)}</h3>
                <p className={s.stepBody}>{t(step.bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          STATS BAND
      ══════════════════════════════════════════════════════════ */}
      <section className={s.statsBand} aria-label="Key numbers">
        <div className="container">
          <div className={s.statsGrid}>
            {STATS.map((stat) => (
              <div key={stat.label} className={s.statItem}>
                <div className={s.statAccent} aria-hidden="true" />
                <p className={s.statVal}>
                  {stat.val}
                  <span className={s.statSuffix}>{stat.suffix}</span>
                </p>
                <p className={s.statLabel}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════════════════════ */}
      <section
        className={`${s.section} ${s.sectionLight}`}
        aria-labelledby="lp-feat-h"
      >
        <div className="container">
          <div className={s.sectionHead}>
            <span className={s.eyebrow}>Built for the field</span>
            <h2 id="lp-feat-h" className={s.sectionTitle}>
              Everything a farmer and officer needs
            </h2>
            <p className={s.sectionSub}>
              Designed for 360 px screens, 2G networks and farmers who have
              never used a smartphone app.
            </p>
          </div>

          <div className={s.featGrid}>
            {FEATURES.map((f) => (
              <article key={f.title} className={s.featCard}>
                <div
                  className={`${s.featIconBox} ${iconColorClass(f.color)}`}
                  aria-hidden="true"
                >
                  <Icon name={f.icon} size={22} />
                </div>
                <h3 className={s.featTitle}>{f.title}</h3>
                <p className={s.featBody}>{f.body}</p>
                <span className={s.featChip}>
                  <Icon name="check" size={11} />
                  {f.chip}
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════════════════ */}
      <section className={s.section} aria-labelledby="lp-quotes-h">
        <div className="container">
          <div className={s.sectionHead}>
            <span className={s.eyebrow}>From the field</span>
            <h2 id="lp-quotes-h" className={s.sectionTitle}>
              Trusted by farmers and officers
            </h2>
          </div>

          <div className={s.quoteGrid}>
            {QUOTES.map((q) => (
              <figure key={q.name} className={s.quoteCard}>
                <div
                  className={s.quoteStars}
                  aria-label={`${q.stars} out of 5 stars`}
                >
                  {"★".repeat(q.stars)}
                </div>
                <blockquote className={s.quoteText}>{q.text}</blockquote>
                <figcaption className={s.quoteAuthor}>
                  <div className={s.quoteAvatar} aria-hidden="true">
                    {q.initials}
                  </div>
                  <div>
                    <p className={s.quoteName}>{q.name}</p>
                    <p className={s.quoteRole}>{q.role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════════ */}
      <section className={s.ctaBand} aria-labelledby="lp-cta-h">
        <div className={s.ctaBandBg} aria-hidden="true">
          <div className={s.ctaBandBlob} />
        </div>

        <div className="container">
          <div className={s.ctaInner}>
            <div>
              <span className={s.ctaEyebrow}>Get started today</span>
              <h2 id="lp-cta-h" className={s.ctaTitle}>
                Ready to plan your next season?
              </h2>
              <p className={s.ctaSub}>
                Get a personalised crop rotation plan in under three minutes.
                No account needed. Works on any phone, even without internet.
              </p>
              <div className={s.ctaActions}>
                <button
                  type="button"
                  className={s.ctaBtnPrimary}
                  onClick={() => navigate("/location")}
                >
                  <Icon name="arrow-right" size={20} />
                  {t("welcome.tryNow")}
                </button>
                <button
                  type="button"
                  className={s.ctaBtnGhost}
                  onClick={() => navigate("/sign-in")}
                >
                  <Icon name="user" size={18} />
                  {t("welcome.officerLink")}
                </button>
              </div>
            </div>

            <div className={s.ctaCards} aria-hidden="true">
              {CTA_CARDS.map((card) => (
                <div key={card.text} className={s.ctaCard}>
                  <div className={s.ctaCardIcon}>
                    <Icon name={card.icon} size={18} />
                  </div>
                  <span className={s.ctaCardText}>{card.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
