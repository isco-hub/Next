import { ApiError } from "@nextcrop/api-client";

type Translate = (key: string, values?: Record<string, string | number>) => string;

export const errorMessage = (error: unknown, t: Translate): string => {
  if (error instanceof ApiError) {
    if (error.isNetworkError) return t("errors.network");
    if (error.status === 401) return t("errors.unauthorized");
    if (error.status === 403) return t("errors.forbidden");
    if (error.status === 404) return t("errors.notFound");
    if (error.status === 429) return t("errors.rateLimited");
    if (error.status >= 500) return t("errors.server");
    if (error.problem?.detail) return error.problem.detail;
    if (error.problem?.title) return error.problem.title;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return t("errors.timeout");
  }
  return t("errors.server");
};

