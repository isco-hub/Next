import { useI18n } from "@nextcrop/i18n";
import { Banner, Button } from "@nextcrop/ui";
import { usePwaUpdate } from "../lib/pwa";

export const UpdatePrompt = () => {
  const { t } = useI18n();
  const { needRefresh, update } = usePwaUpdate();
  if (!needRefresh) return null;

  return (
    <div className="floatingNotice">
      <Banner
        tone="info"
        title={t("update.title")}
        action={
          <div className="row">
            <Button size="small" onClick={update}>
              {t("update.reload")}
            </Button>
          </div>
        }
      >
        {t("update.body")}
      </Banner>
    </div>
  );
};

