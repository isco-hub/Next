import { useEffect, useState } from "react";
import {
  ApiError,
  constituencyOptions,
  districtOptions,
  subcountyOptionsForConstituency,
  type Role,
  type Session,
} from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import { Banner, Button, Field, Icon, inputClass, selectClass } from "@nextcrop/ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { api, demoMode } from "../lib/api";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/errors";
import { roleHome } from "../lib/roles";

const CONSENT_VERSION = "2026-01";
const DEMO_PHONES: { role: Role; phone: string; labelKey: string }[] = [
  { role: "extension_officer", phone: "+256770000001", labelKey: "auth.demoOfficer" },
  { role: "admin", phone: "+256770000002", labelKey: "auth.demoAdmin" },
  { role: "farmer", phone: "+256770000003", labelKey: "auth.demoFarmer" },
];

const ROLE_OPTIONS: { role: Role; labelKey: string }[] = [
  { role: "farmer", labelKey: "auth.roleFarmer" },
  { role: "extension_officer", labelKey: "auth.roleOfficer" },
  { role: "admin", labelKey: "auth.roleAdmin" },
];
type Mode = "signin" | "signup";

export const SignInPage = () => {
  const { t } = useI18n();
  const { user, completeSignIn, busy } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [selectedRole, setSelectedRole] = useState<Role>("farmer");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [constituencyId, setConstituencyId] = useState("");
  const [subcountyId, setSubcountyId] = useState("");
  const [pendingMessage, setPendingMessage] = useState("");
  const [requestId, setRequestId] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [demoBusy, setDemoBusy] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(
      () => setResendIn((value) => Math.max(0, value - 1)),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [resendIn]);

  const finish = async (session: Session) => {
    completeSignIn(session);
    try {
      await api.createConsent({
        version: CONSENT_VERSION,
        channels: ["web", "sms"],
        data_sharing: false,
        language: session.user.language,
      });
    } catch {
      // Consent is recorded when possible; sign-in is not blocked by it.
    }
    navigate(roleHome(session.user.role), { replace: true });
  };

  const officerSignup = mode === "signup" && selectedRole === "extension_officer";
  const roleOptions =
    mode === "signup"
      ? ROLE_OPTIONS.filter((option) => option.role !== "admin")
      : ROLE_OPTIONS;

  const requestCode = async () => {
    if (phone.replace(/\D/g, "").length < 9) {
      setError(t("auth.phoneInvalid"));
      return;
    }
    if (mode === "signup" && displayName.trim().length < 2) {
      setError(t("auth.nameInvalid"));
      return;
    }
    if (officerSignup && (!districtId || !constituencyId || !subcountyId)) {
      setError(t("auth.locationRequired"));
      return;
    }
    if (!consent) {
      setError(t("consent.required"));
      return;
    }
    setSending(true);
    setError("");
    try {
      const request = await api.requestOtp({
        phone,
        purpose: mode,
        role: selectedRole,
        display_name: mode === "signup" ? displayName.trim() : undefined,
        language: "en",
        district_id: officerSignup ? districtId : undefined,
        constituency_id: officerSignup ? constituencyId : undefined,
        subcounty_ids: officerSignup && subcountyId ? [subcountyId] : [],
      });
      setRequestId(request.request_id);
      setStep("code");
      setResendIn(30);
      setCode(request.dev_code ?? "");
      setDevCode(request.dev_code ?? "");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? t("auth.rateLimitedBody")
          : errorMessage(err, t),
      );
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    setVerifying(true);
    setError("");
    try {
      const result = await api.verifyOtp(requestId, code);
      if (!("token" in result)) {
        setPendingMessage(result.message);
        setStep("phone");
        setCode("");
        return;
      }
      await finish(result);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 422
          ? t("auth.invalidCode")
          : errorMessage(err, t),
      );
    } finally {
      setVerifying(false);
    }
  };

  const demoSignIn = async (demoPhone: string) => {
    if (!consent) {
      setError(t("consent.required"));
      return;
    }
    setDemoBusy(demoPhone);
    setError("");
    try {
      const request = await api.requestOtp(demoPhone);
      const result = await api.verifyOtp(request.request_id, "123456");
      if (!("token" in result)) {
        setPendingMessage(result.message);
        return;
      }
      await finish(result);
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setDemoBusy("");
    }
  };

  if (user) {
    return (
      <div className="page container narrow">
        <PageHeader
          title={t("auth.signInTitle")}
          subtitle={t("auth.signedInAs", {
            name: user.display_name ?? t("common.appName"),
          })}
        />
        <div className="row">
          <Button onClick={() => navigate(roleHome(user.role))}>
            {t("dashboard.openDashboard")}
          </Button>
          <Button variant="secondary" onClick={() => navigate("/settings")}>
            {t("nav.settings")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page container narrow authPage">
      <PageHeader
        title={mode === "signup" ? t("auth.signUpTitle") : t("auth.signInTitle")}
        subtitle={
          mode === "signup" ? t("auth.signUpIntro") : t("auth.signInIntro")
        }
      />

      {error ? <Banner tone="error">{error}</Banner> : null}
      {pendingMessage ? (
        <Banner tone="info" title={t("auth.pendingTitle")}>
          {pendingMessage}
        </Banner>
      ) : null}

      {step === "phone" ? (
        <section className="panel stack">
          <div className="row" role="group" aria-label={t("auth.accountMode")}>
            <Button
              variant={mode === "signin" ? "primary" : "secondary"}
              onClick={() => {
                setMode("signin");
                setError("");
                setPendingMessage("");
              }}
            >
              {t("auth.signInTab")}
            </Button>
            <Button
              variant={mode === "signup" ? "primary" : "secondary"}
              onClick={() => {
                setMode("signup");
                setSelectedRole((current) =>
                  current === "admin" ? "farmer" : current,
                );
                setError("");
                setPendingMessage("");
              }}
            >
              {t("auth.createAccount")}
            </Button>
          </div>

          <Field label={t("auth.selectRole")} htmlFor="sign-in-role" required>
            <select
              id="sign-in-role"
              className={selectClass(false)}
              value={selectedRole}
              onChange={(event) => {
                setSelectedRole(event.target.value as Role);
                setDistrictId("");
                setConstituencyId("");
                setSubcountyId("");
                setError("");
              }}
            >
              {roleOptions.map((option) => (
                <option key={option.role} value={option.role}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </Field>
          {officerSignup ? (
            <p className="muted small">{t("auth.officerSignupNote")}</p>
          ) : null}

          {mode === "signup" ? (
            <Field label={t("auth.nameLabel")} htmlFor="display-name" required>
              <input
                id="display-name"
                className={inputClass(false)}
                autoComplete="name"
                placeholder={t("auth.namePlaceholder")}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </Field>
          ) : null}

          {officerSignup ? (
            <>
              <Field
                label={t("auth.districtLabel")}
                htmlFor="signup-district"
                required
              >
                <select
                  id="signup-district"
                  className={selectClass(false)}
                  value={districtId}
                  onChange={(event) => {
                    setDistrictId(event.target.value);
                    setConstituencyId("");
                    setSubcountyId("");
                  }}
                >
                  <option value="">{t("auth.selectPlaceholder")}</option>
                  {districtOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={t("auth.constituencyLabel")}
                htmlFor="signup-constituency"
                required
              >
                <select
                  id="signup-constituency"
                  className={selectClass(false)}
                  value={constituencyId}
                  disabled={!districtId}
                  onChange={(event) => {
                    setConstituencyId(event.target.value);
                    setSubcountyId("");
                  }}
                >
                  <option value="">{t("auth.selectPlaceholder")}</option>
                  {constituencyOptions(districtId).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={t("auth.subcountyLabel")}
                htmlFor="signup-subcounty"
                required
              >
                <select
                  id="signup-subcounty"
                  className={selectClass(false)}
                  value={subcountyId}
                  disabled={!constituencyId}
                  onChange={(event) => setSubcountyId(event.target.value)}
                >
                  <option value="">{t("auth.selectPlaceholder")}</option>
                  {subcountyOptionsForConstituency(constituencyId).map(
                    (option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </Field>
            </>
          ) : null}

          <Field
            label={t("auth.phoneLabel")}
            htmlFor="phone"
            hint={t("auth.phoneHint")}
            required
          >
            <input
              id="phone"
              className={inputClass(false)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t("auth.phonePlaceholder")}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>

          <div className="toggleRow">
            <div className="toggleText">
              <strong>{t("consent.title")}</strong>
              <p>{t("consent.purposeBody")}</p>
              <p>{t("auth.otpPrivacy")}</p>
            </div>
          </div>

          <label className="row" htmlFor="consent">
            <input
              id="consent"
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>{t("consent.accept")}</span>
          </label>

          <Button
            onClick={() => {
              void requestCode();
            }}
            loading={sending}
            loadingLabel={t("auth.sending")}
            icon={<Icon name="phone" size={18} />}
          >
            {mode === "signup" ? t("auth.signUpAction") : t("auth.sendCode")}
          </Button>
        </section>
      ) : (
        <section className="panel stack">
          <Banner tone="info" title={t("auth.codeTitle")}>
            {t("auth.codeIntro", { phone })}
          </Banner>
          <Field label={t("auth.codeLabel")} htmlFor="code">
            <input
              id="code"
              className={inputClass(false)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </Field>
          {demoMode ? (
            <p className="pill">{t("auth.demoHint", { code: "123456" })}</p>
          ) : devCode ? (
            <p className="pill">{t("auth.demoHint", { code: devCode })}</p>
          ) : null}
          <div className="row">
            <Button
              onClick={() => {
                void verify();
              }}
              loading={verifying || busy}
              loadingLabel={t("auth.verifying")}
            >
              {t("auth.verify")}
            </Button>
            <Button
              variant="secondary"
              disabled={resendIn > 0 || sending}
              onClick={() => {
                void requestCode();
              }}
            >
              {resendIn > 0
                ? t("auth.resendIn", { seconds: resendIn })
                : t("auth.resend")}
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError("");
            }}
          >
            {t("auth.backToPhone")}
          </Button>
        </section>
      )}

      {demoMode ? (
        <section className="panel stack">
          <div>
            <h2>{t("auth.demoAccounts")}</h2>
            <p className="muted small">{t("welcome.demoNote")}</p>
          </div>
          <div className="choiceRow">
            {DEMO_PHONES.map((account) => (
              <Button
                key={account.role}
                variant="secondary"
                loading={demoBusy === account.phone}
                onClick={() => {
                  void demoSignIn(account.phone);
                }}
                icon={<Icon name="user" size={18} />}
              >
                {t(account.labelKey)}
              </Button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};
