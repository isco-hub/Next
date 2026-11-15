import { useI18n } from "@nextcrop/i18n";
import { Button, ErrorState, Skeleton } from "@nextcrop/ui";
import { errorMessage } from "../lib/errors";

export const LoadingPanel = ({ label }: { label?: string }) => {
  const { t } = useI18n();
  return (
    <div className="panel" role="status" aria-live="polite">
      <Skeleton height="1.4rem" width="52%" />
      <Skeleton height="0.9rem" width="84%" />
      <Skeleton height="0.9rem" width="72%" />
      <span className="srOnly">{label ?? t("common.loading")}</span>
    </div>
  );
};

export const QueryErrorState = ({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) => {
  const { t } = useI18n();
  return (
    <ErrorState
      body={errorMessage(error, t)}
      action={
        onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        ) : undefined
      }
    />
  );
};

