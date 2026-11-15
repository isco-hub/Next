import { englishKeys, englishMessages } from "@nextcrop/i18n";
import { useI18n } from "@nextcrop/i18n";
import { Button } from "@nextcrop/ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";

export const TranslationPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="page container">
      <PageHeader
        eyebrow={t("nav.admin")}
        title={t("admin.translationsTitle")}
        subtitle={t("admin.translationsIntro")}
        actions={
          <Button variant="secondary" onClick={() => navigate("/admin")}>
            {t("common.back")}
          </Button>
        }
      />
      <div className="panel stack">
        <p className="muted">
          Only English is supported. {englishKeys.length} keys loaded.
        </p>
        <p className="muted small">
          {Object.keys(englishMessages).length} messages available.
        </p>
      </div>
    </div>
  );
};
