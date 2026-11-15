import { useI18n } from "@nextcrop/i18n";
import { Button, EmptyState } from "@nextcrop/ui";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";

export const NotFoundPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="page container narrow">
      <PageHeader
        eyebrow={t("common.notFoundTitle")}
        title={t("common.notFoundTitle")}
        subtitle={t("common.notFoundBody")}
      />
      <EmptyState
        icon="search"
        title={t("common.notFoundTitle")}
        body={t("common.notFoundBody")}
        action={
          <Button onClick={() => navigate("/")}>{t("common.backHome")}</Button>
        }
      />
    </div>
  );
};
