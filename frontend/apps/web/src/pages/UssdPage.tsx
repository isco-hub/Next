import { useState } from "react";
import { useI18n } from "@nextcrop/i18n";
import { Badge, Banner, Button, Field, Icon, inputClass, selectClass } from "@nextcrop/ui";
import { PageHeader } from "../components/PageHeader";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";

const SERVICE_CODE = "*384*2026#";
const NETWORKS = ["MTN", "Airtel"];
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
const FLOW_KEYS = [
  "ussd.flowMenu",
  "ussd.flowCrop",
  "ussd.flowSoil",
  "ussd.flowGoal",
  "ussd.flowDistrict",
  "ussd.flowSubcounty",
  "ussd.flowResult",
];

interface ScreenEntry {
  input: string;
  response: string;
}

const newSessionId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ussd-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
};

export const UssdPage = () => {
  const { t, formatNumber } = useI18n();
  const [phone, setPhone] = useState("+256770000003");
  const [network, setNetwork] = useState(NETWORKS[0] ?? "MTN");
  const [sessionId, setSessionId] = useState("");
  const [path, setPath] = useState("");
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [history, setHistory] = useState<ScreenEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const active = response.startsWith("CON");
  const started = Boolean(response);
  const overLimit = response.length > 160;

  const callback = async (nextSession: string, text: string, shown: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await api.ussdCallback({
        session_id: nextSession,
        service_code: SERVICE_CODE,
        phone_number: phone,
        network_code: network,
        text,
      });
      setResponse(result.response);
      setHistory((current) => [
        ...current,
        { input: shown, response: result.response },
      ]);
    } catch (callbackError) {
      setError(
        t("ussd.callbackError") + " " + errorMessage(callbackError, t),
      );
    } finally {
      setBusy(false);
    }
  };

  const dial = async () => {
    const id = newSessionId();
    setSessionId(id);
    setPath("");
    setInput("");
    setResponse("");
    setHistory([]);
    await callback(id, "", "");
  };

  const send = async (value: string) => {
    if (!sessionId || !active || busy) return;
    const clean = value.trim();
    if (!clean) return;
    const nextPath = path ? `${path}*${clean}` : clean;
    setPath(nextPath);
    setInput("");
    await callback(sessionId, nextPath, clean);
  };

  const hangUp = () => {
    setSessionId("");
    setPath("");
    setResponse("");
    setInput("");
  };

  const status = response.startsWith("END") ? "end" : "con";

  return (
    <div className="page container">
      <PageHeader
        eyebrow={t("nav.ussd")}
        title={t("ussd.title")}
        subtitle={t("ussd.subtitle")}
      />

      <Banner tone="info">{t("ussd.demoHint")}</Banner>
      {error ? <Banner tone="error">{error}</Banner> : null}

      <div className="grid2">
        <section className="panel stack">
          <h2>{t("ussd.phoneFrame")}</h2>
          <div className="phoneFrame">
            <div className="phoneTop">
              <span>{network}</span>
              <span>{phone || t("ussd.phoneLabel")}</span>
            </div>
            <div className="phoneScreen" aria-live="polite">
              {started
                ? response
                : t("ussd.startPrompt")}
            </div>
            <div className="phoneKeypad">
              {KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="phoneKey"
                  onClick={() => setInput((current) => `${current}${key}`)}
                  disabled={!active}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          <div className="row">
            <Button
              onClick={() => {
                void dial();
              }}
              loading={busy && !started}
              loadingLabel={t("common.loading")}
              icon={<Icon name="phone" size={18} />}
            >
              {t("ussd.dial")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void send("1");
              }}
              disabled={!active || busy}
            >
              {t("ussd.call")}
            </Button>
            <Button variant="ghost" onClick={hangUp} disabled={!started}>
              {t("ussd.hangUp")}
            </Button>
          </div>
        </section>

        <section className="panel stack">
          <h2>{t("ussd.session")}</h2>
          <div className="row-between">
            <Badge tone={status === "end" ? "neutral" : "success"}>
              {status === "end" ? t("ussd.end") : t("ussd.con")}
            </Badge>
            <span className="muted small">
              {t("ussd.screenCount", { count: formatNumber(history.length) })}
            </span>
          </div>

          <Field label={t("ussd.phoneLabel")} htmlFor="ussd-phone">
            <input
              id="ussd-phone"
              className={inputClass(false)}
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>
          <Field label={t("ussd.network")} htmlFor="ussd-network">
            <select
              id="ussd-network"
              className={selectClass(false)}
              value={network}
              onChange={(event) => setNetwork(event.target.value)}
            >
              {NETWORKS.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("ussd.inputLabel")} htmlFor="ussd-input">
            <input
              id="ussd-input"
              className={inputClass(false)}
              inputMode="numeric"
              placeholder={t("ussd.inputPlaceholder")}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void send(input);
                }
              }}
              disabled={!active}
            />
          </Field>
          <div className="row">
            <Button
              onClick={() => {
                void send(input);
              }}
              disabled={!active || busy}
              loading={busy && started}
              loadingLabel={t("common.submitting")}
              icon={<Icon name="send" size={18} />}
            >
              {t("ussd.send")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setInput((current) => current.slice(0, -1))}
              disabled={!input}
            >
              {t("ussd.deleteChar")}
            </Button>
          </div>
          <p className="muted small">{t("ussd.screenHint")}</p>

          <div>
            <h3>{t("ussd.characterCounter")}</h3>
            <p className={overLimit ? "textDanger" : "muted small"}>
              {t("ussd.chars", { count: formatNumber(response.length) })}
              {" · "}
              {t("ussd.charsLeft", { count: formatNumber(160 - response.length) })}
            </p>
            {overLimit ? <Banner tone="error">{t("ussd.overLimit")}</Banner> : null}
          </div>

          <div>
            <h3>{t("ussd.allScreens")}</h3>
            <ol className="listReset">
              {FLOW_KEYS.map((key, index) => (
                <li key={key} className="listRow">
                  <span>{t(key)}</span>
                  <span className="muted small">{formatNumber(index + 1)}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      <section className="panel stack">
        <div className="row-between">
          <h2>{t("ussd.history")}</h2>
          <Button
            variant="ghost"
            size="small"
            onClick={() => setHistory([])}
            disabled={history.length === 0}
          >
            {t("ussd.clearHistory")}
          </Button>
        </div>
        {history.length === 0 ? (
          <p className="muted">{t("ussd.startPrompt")}</p>
        ) : (
          <div
            className="screenHistory"
            role="region"
            aria-label={t("ussd.history")}
            tabIndex={0}
          >
            <ol className="screenHistoryList">
              {history.map((entry, index) => (
                <li key={`${index}-${entry.input}`}>
                  <strong>{entry.input || t("ussd.dial")}</strong>
                  <br />
                  {entry.response}
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
};
