import { useState } from "react";
import type { Role } from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banner,
  Button,
  Field,
  Icon,
  Sheet,
  inputClass,
} from "@nextcrop/ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/errors";
import { useInstallPrompt } from "../lib/install";
import { usePrefs } from "../lib/prefs";

const ROLE_KEYS: Record<Role, string> = {
  farmer: "auth.roleFarmer",
  extension_officer: "auth.roleOfficer",
  cooperative: "auth.roleCooperative",
  agronomist: "auth.roleAgronomist",
  admin: "auth.roleAdmin",
};

export const SettingsPage = () => {
  const { t, pseudo, setPseudo } = useI18n();
  const { user, signOut } = useAuth();
  const { lowData, setLowData, largerText, setLargerText, smsAlerts, setSmsAlerts, quietFrom, quietTo, setQuietHours } = usePrefs();
  const { canInstall, install } = useInstallPrompt();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmWord, setConfirmWord] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [actionError, setActionError] = useState("");
  const [quietFromDraft, setQuietFromDraft] = useState(quietFrom);
  const [quietToDraft, setQuietToDraft] = useState(quietTo);
  const [quietSaved, setQuietSaved] = useState(false);

  const dataQuery = useQuery({
    queryKey: ["myData", user?.id],
    queryFn: () => api.getDataRights(),
    enabled: Boolean(user),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteMyData(),
    onSuccess: async () => {
      try {
        await signOut();
      } catch {
        // The account is already deleted.
      }
      queryClient.clear();
      navigate("/", { replace: true });
    },
    onError: (error) => setDeleteError(errorMessage(error, t)),
  });


  const downloadData = () => {
    if (!dataQuery.data) return;
    try {
      const blob = new Blob([JSON.stringify(dataQuery.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "nextcrop-my-data.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setActionError(t("errors.server"));
    }
  };

  const signOutNow = async () => {
    setActionError("");
    await signOut();
    queryClient.clear();
    navigate("/");
  };

  return (
    <div className="page container narrow">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      {actionError ? <Banner tone="error">{actionError}</Banner> : null}

      <section className="panel stack">
        <h2>{t("settings.displayTitle")}</h2>
        <div className="toggleRow">
          <div className="toggleText">
            <strong>{t("lowData.label")}</strong>
            <p>{t("lowData.hint")}</p>
          </div>
          <input
            type="checkbox"
            checked={lowData}
            onChange={(event) => setLowData(event.target.checked)}
            aria-label={t("lowData.label")}
          />
        </div>
        <div className="toggleRow">
          <div className="toggleText">
            <strong>{t("common.accessibility")}</strong>
            <p>{t("settings.accessibilityBody")}</p>
          </div>
          <input
            type="checkbox"
            checked={largerText}
            onChange={(event) => setLargerText(event.target.checked)}
            aria-label={t("common.accessibility")}
          />
        </div>
        {import.meta.env.DEV ? (
          <div className="toggleRow">
            <div className="toggleText">
              <strong>{t("settings.pseudoTitle")}</strong>
              <p>{t("settings.pseudoHint")}</p>
            </div>
            <input
              type="checkbox"
              checked={pseudo}
              onChange={(event) => setPseudo(event.target.checked)}
              aria-label={t("settings.pseudoTitle")}
            />
          </div>
        ) : null}
        {canInstall ? (
          <div className="row">
            <Button
              variant="secondary"
              onClick={() => {
                void install();
              }}
              icon={<Icon name="download" size={18} />}
            >
              {t("install.button")}
            </Button>
            <span className="muted small">{t("install.body")}</span>
          </div>
        ) : null}
      </section>

      <section className="panel stack">
        <h2>{t("settings.accountTitle")}</h2>
        {user ? (
          <>
            <dl className="infoGrid">
              <div>
                <dt>{t("nav.account")}</dt>
                <dd>{user.display_name ?? t("common.appName")}</dd>
              </div>
              <div>
                <dt>{t("common.status")}</dt>
                <dd>{t(ROLE_KEYS[user.role])}</dd>
              </div>
            </dl>
            <Button
              variant="secondary"
              onClick={() => {
                void signOutNow();
              }}
              icon={<Icon name="logout" size={18} />}
            >
              {t("nav.signOut")}
            </Button>
          </>
        ) : (
          <>
            <p className="muted">{t("settings.signedOut")}</p>
            <Button onClick={() => navigate("/sign-in")} icon={<Icon name="user" size={18} />}>
              {t("nav.signIn")}
            </Button>
          </>
        )}
        <p className="muted small" style={{ marginBottom: 0 }}>
          {t("settings.demoNote")}
        </p>
      </section>

      <section className="panel stack">
        <h2>{t("settings.alertsTitle")}</h2>
        <p className="muted small">{t("settings.alertsSubtitle")}</p>
        <div className="toggleRow">
          <div className="toggleText">
            <strong>{t("settings.smsAlertsLabel")}</strong>
            <p>{t("settings.smsAlertsHint")}</p>
          </div>
          <input
            type="checkbox"
            checked={smsAlerts}
            onChange={(e) => setSmsAlerts(e.target.checked)}
            aria-label={t("settings.smsAlertsLabel")}
          />
        </div>
        {smsAlerts ? (
          <div className="stack">
            <strong>{t("settings.quietHoursLabel")}</strong>
            <p className="muted small">{t("settings.quietHoursHint")}</p>
            <div className="row">
              <Field label={t("settings.quietFrom")} htmlFor="quiet-from">
                <input
                  id="quiet-from"
                  type="time"
                  className={inputClass(false)}
                  value={quietFromDraft}
                  onChange={(e) => { setQuietFromDraft(e.target.value); setQuietSaved(false); }}
                />
              </Field>
              <Field label={t("settings.quietTo")} htmlFor="quiet-to">
                <input
                  id="quiet-to"
                  type="time"
                  className={inputClass(false)}
                  value={quietToDraft}
                  onChange={(e) => { setQuietToDraft(e.target.value); setQuietSaved(false); }}
                />
              </Field>
            </div>
            <div className="row">
              <Button
                variant="secondary"
                onClick={() => { setQuietHours(quietFromDraft, quietToDraft); setQuietSaved(true); }}
                icon={<Icon name="check" size={18} />}
              >
                {t("common.save")}
              </Button>
              {quietSaved ? <span className="muted small">{t("settings.quietSaved")}</span> : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel stack">
        <h2>{t("settings.privacyTitle")}</h2>
        <p className="muted">{t("consent.purposeBody")}</p>
        <div>
          <h3>{t("dataRights.retention")}</h3>
          <p className="muted small">{t("dataRights.retentionBody")}</p>
        </div>

        {!user ? <Banner tone="info">{t("dataRights.authRequired")}</Banner> : null}
        {dataQuery.isError ? (
          <Banner tone="error">{errorMessage(dataQuery.error, t)}</Banner>
        ) : null}

        {user && dataQuery.data ? (
          <>
            <dl className="infoGrid">
              <div>
                <dt>{t("dataRights.plotsCount", {
                  count: dataQuery.data.plots.length,
                })}</dt>
                <dd>{dataQuery.data.plots.map((plot) => plot.name).join(", ") || t("common.none")}</dd>
              </div>
              <div>
                <dt>{t("dataRights.plansCount", {
                  count: dataQuery.data.recommendations.length,
                })}</dt>
                <dd>{t("plan.title")}</dd>
              </div>
              <div>
                <dt>{t("dataRights.consentsCount", {
                  count: dataQuery.data.consents.length,
                })}</dt>
                <dd>{t("consent.version", { version: "2026-01" })}</dd>
              </div>
            </dl>
            <div className="row">
              <Button
                variant="secondary"
                onClick={downloadData}
                icon={<Icon name="download" size={18} />}
              >
                {t("dataRights.download")}
              </Button>
              <Button
                variant="dangerGhost"
                onClick={() => {
                  setDeleteError("");
                  setConfirmWord("");
                  setDeleteOpen(true);
                }}
                icon={<Icon name="trash" size={18} />}
              >
                {t("dataRights.deleteData")}
              </Button>
            </div>
          </>
        ) : null}
      </section>

      <Sheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t("dataRights.deleteTitle")}
        closeLabel={t("common.closeDialog")}
        footer={
          <div className="row-between">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={confirmWord !== t("dataRights.confirmWord")}
              loading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {t("common.confirmDelete")}
            </Button>
          </div>
        }
      >
        <div className="stack">
          <p>{t("dataRights.deleteBody")}</p>
          <Banner tone="error">{t("dataRights.deleteWarning")}</Banner>
          {deleteError ? <Banner tone="error">{deleteError}</Banner> : null}
          <Field
            label={t("dataRights.deleteConfirmLabel")}
            htmlFor="delete-confirm"
            required
          >
            <input
              id="delete-confirm"
              className={inputClass(false)}
              value={confirmWord}
              onChange={(event) => setConfirmWord(event.target.value)}
              autoComplete="off"
            />
          </Field>
        </div>
      </Sheet>
    </div>
  );
};
