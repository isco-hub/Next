import { useState } from "react";
import { useI18n } from "@nextcrop/i18n";
import { Banner, Button } from "@nextcrop/ui";
import { useInstallPrompt } from "../lib/install";

const DISMISS_KEY = "nextcrop.install.dismissed.v1";

export const InstallPrompt = () => {
  const { t } = useI18n();
  const { canInstall, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (!canInstall || dismissed) return null;

  return (
    <div className="floatingNotice">
      <Banner
        tone="success"
        title={t("install.title")}
        action={
          <div className="row">
            <Button
              size="small"
              onClick={() => {
                void install();
              }}
            >
              {t("install.button")}
            </Button>
            <Button
              size="small"
              variant="ghost"
              onClick={() => {
                setDismissed(true);
                try {
                  window.localStorage.setItem(DISMISS_KEY, "1");
                } catch {
                  // Dismissal is cosmetic.
                }
              }}
            >
              {t("install.dismiss")}
            </Button>
          </div>
        }
      >
        {t("install.body")}
      </Banner>
    </div>
  );
};

