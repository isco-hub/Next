import { createApiClient } from "@nextcrop/api-client";
import { currentToken } from "./session";

export const demoMode =
  import.meta.env.VITE_USE_MOCKS === "true" || import.meta.env.MODE === "test";

export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "/v1",
  getToken: currentToken,
  retries: 2,
  timeoutMs: 15_000,
});

