import type { ReactNode } from "react";
import { useI18n } from "@nextcrop/i18n";
import { EmptyState } from "./EmptyState";

export interface ErrorStateProps {
  title?: string;
  body?: string;
  action?: ReactNode;
  traceId?: string | null;
}

export const ErrorState = ({ title, body, action, traceId }: ErrorStateProps) => {
  const { t } = useI18n();
  return (
    <EmptyState
      icon="alert"
      title={title ?? t("common.errorTitle")}
      body={body ?? t("common.errorBody")}
      action={
        <>
          {action}
          {traceId ? (
            <p className="muted" style={{ fontSize: "0.8125rem" }}>
              {t("common.traceId", { traceId })}
            </p>
          ) : null}
        </>
      }
    />
  );
};
