import type {
  ApiProblem,
  AssistedRegistrationInput,
  AssistedRegistrationResult,
  AuditEntry,
  BulkSmsInput,
  BulkSmsResult,
  ConsentInput,
  ConsentRecord,
  DataRightsSummary,
  Feedback,
  FeedbackInput,
  FieldObservation,
  FieldObservationInput,
  Health,
  OfficerSummary,
  OtpRequestInput,
  OtpRequestResult,
  Plot,
  PlotInput,
  Recommendation,
  RecommendationRequest,
  RecommendationSummary,
  ReportSummary,
  RulePack,
  RulePackInput,
  RuleSimulationInput,
  RuleSimulationResult,
  Session,
  UssdCallbackRequest,
  UssdCallbackResult,
  User,
} from "./types";

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  getToken?: () => string | null;
  retries?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ApiProblem | null;
  readonly traceId: string | null;

  constructor(
    message: string,
    status: number,
    problem: ApiProblem | null = null,
    traceId: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
    this.traceId = traceId ?? problem?.trace_id ?? null;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isRetryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }

  get fieldErrors(): { field: string; message: string }[] {
    return this.problem?.errors ?? [];
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
  rawText?: boolean;
  retry?: boolean;
}

interface RequestResult<T> {
  data: T;
  status: number;
  headers: Headers;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export class NextCropApi {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly getToken?: () => string | null;
  private readonly retries: number;
  private readonly timeoutMs: number;
  private readonly retryDelayMs: number;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "/v1").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.getToken = options.getToken;
    this.retries = options.retries ?? 2;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.retryDelayMs = options.retryDelayMs ?? 250;
  }

  private async request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<RequestResult<T>> {
    const {
      method = "GET",
      body,
      signal,
      idempotencyKey,
      rawText = false,
      retry = method === "GET",
    } = options;
    const url = `${this.baseUrl}${path}`;
    const attempts = retry ? this.retries + 1 : 1;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const abort = () => controller.abort();
      signal?.addEventListener("abort", abort, { once: true });

      try {
        const headers: Record<string, string> = {
          Accept: rawText ? "text/plain" : "application/json",
        };
        if (body !== undefined) headers["Content-Type"] = "application/json";
        if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
        const token = this.getToken?.();
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await this.fetchImpl(url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
          credentials: "include",
        });

        if (rawText) {
          const text = await response.text();
          if (!response.ok) {
            throw this.toError(text, response, null);
          }
          return { data: text as T, status: response.status, headers: response.headers };
        }

        const contentType = response.headers.get("content-type") ?? "";
        let payload: unknown = null;
        if (response.status !== 204) {
          payload = contentType.includes("json")
            ? await response.json().catch(() => null)
            : await response.text();
        }

        if (!response.ok) {
          const problem =
            isRecord(payload) && typeof payload.title === "string"
              ? (payload as unknown as ApiProblem)
              : null;
          throw this.toError(
            problem?.detail ?? problem?.title ?? `Request failed with ${response.status}`,
            response,
            problem,
            payload,
          );
        }

        return {
          data: payload as T,
          status: response.status,
          headers: response.headers,
        };
      } catch (error) {
        lastError = error;
        const apiError = error instanceof ApiError ? error : null;
        const aborted = signal?.aborted;
        const retryable = apiError ? apiError.isRetryable : true;
        if (aborted || attempt >= attempts - 1 || !retryable) {
          if (apiError) throw apiError;
          throw new ApiError(
            error instanceof Error ? error.message : "Network request failed",
            0,
          );
        }
        await sleep(this.retryDelayMs * 2 ** attempt);
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abort);
      }
    }

    if (lastError instanceof ApiError) throw lastError;
    throw new ApiError("Network request failed", 0);
  }

  private toError(
    message: string,
    response: Response,
    problem: ApiProblem | null,
    payload?: unknown,
  ): ApiError {
    const fallbackProblem: ApiProblem | null = problem
      ? problem
      : isRecord(payload) && typeof payload.title === "string"
        ? (payload as unknown as ApiProblem)
        : null;
    const traceId =
      response.headers.get("x-trace-id") ??
      response.headers.get("traceparent") ??
      fallbackProblem?.trace_id ??
      null;
    return new ApiError(message, response.status, fallbackProblem, traceId);
  }

  health(): Promise<Health> {
    return this.request<Health>("/health").then((result) => result.data);
  }

  getOutlook(params: {
    lat?: number;
    lon?: number;
    district_id?: string;
    subcounty_id?: string;
  }): Promise<import("./types").Outlook> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, String(value));
      }
    }
    return this.request<import("./types").Outlook>(`/outlook?${search.toString()}`).then(
      (result) => result.data,
    );
  }

  createRecommendation(
    input: RecommendationRequest,
    idempotencyKey?: string,
  ): Promise<Recommendation> {
    return this.request<Recommendation>("/recommendations", {
      method: "POST",
      body: input,
      idempotencyKey,
    }).then((result) => result.data);
  }

  getRecommendation(id: string): Promise<Recommendation> {
    return this.request<Recommendation>(
      `/recommendations/${encodeURIComponent(id)}`,
    ).then((result) => result.data);
  }

  listPlots(): Promise<Plot[]> {
    return this.request<Plot[]>("/plots").then((result) => result.data);
  }

  createPlot(input: PlotInput): Promise<Plot> {
    return this.request<Plot>("/plots", { method: "POST", body: input }).then(
      (result) => result.data,
    );
  }

  updatePlot(id: string, input: Partial<PlotInput>): Promise<Plot> {
    return this.request<Plot>(`/plots/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: input,
    }).then((result) => result.data);
  }

  deletePlot(id: string): Promise<void> {
    return this.request<void>(`/plots/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }).then(() => undefined);
  }

  listRecommendations(): Promise<RecommendationSummary[]> {
    return this.request<RecommendationSummary[]>("/recommendations").then(
      (result) => result.data,
    );
  }

  submitFeedback(
    input: FeedbackInput,
    idempotencyKey?: string,
  ): Promise<Feedback> {
    return this.request<Feedback>("/feedback", {
      method: "POST",
      body: input,
      idempotencyKey,
    }).then((result) => result.data);
  }

  requestOtp(input: OtpRequestInput | string): Promise<OtpRequestResult> {
    const body = typeof input === "string" ? { phone: input } : input;
    return this.request<OtpRequestResult>("/auth/otp/request", {
      method: "POST",
      body,
    }).then((result) => result.data);
  }

  verifyOtp(requestId: string, code: string): Promise<Session> {
    return this.request<Session>("/auth/otp/verify", {
      method: "POST",
      body: { request_id: requestId, code },
    }).then((result) => result.data);
  }

  refreshSession(refreshToken: string): Promise<Session> {
    return this.request<Session>("/auth/refresh", {
      method: "POST",
      body: { refresh_token: refreshToken },
    }).then((result) => result.data);
  }

  getMe(): Promise<User> {
    return this.request<User>("/auth/me").then((result) => result.data);
  }

  signOut(): Promise<void> {
    return this.request<void>("/auth/session", { method: "DELETE" }).then(
      () => undefined,
    );
  }

  createConsent(input: ConsentInput): Promise<ConsentRecord> {
    return this.request<ConsentRecord>("/auth/consent", {
      method: "POST",
      body: input,
    }).then((result) => result.data);
  }

  getDataRights(): Promise<DataRightsSummary> {
    return this.request<DataRightsSummary>("/auth/me/data-rights").then(
      (result) => result.data,
    );
  }

  deleteMyData(): Promise<void> {
    return this.request<void>("/auth/me", { method: "DELETE" }).then(
      () => undefined,
    );
  }

  getOfficerSummary(subcountyId?: string): Promise<OfficerSummary> {
    const search = subcountyId
      ? `?subcounty_id=${encodeURIComponent(subcountyId)}`
      : "";
    return this.request<OfficerSummary>(`/extension/summary${search}`).then(
      (result) => result.data,
    );
  }

  assistedRegistration(
    input: AssistedRegistrationInput,
  ): Promise<AssistedRegistrationResult> {
    return this.request<AssistedRegistrationResult>(
      "/extension/register",
      { method: "POST", body: input },
    ).then((result) => result.data);
  }

  listObservations(): Promise<FieldObservation[]> {
    return this.request<FieldObservation[]>("/extension/observations").then(
      (result) => result.data,
    );
  }

  createObservation(
    input: FieldObservationInput,
  ): Promise<FieldObservation> {
    return this.request<FieldObservation>("/extension/observations", {
      method: "POST",
      body: input,
    }).then((result) => result.data);
  }

  sendBulkSms(input: BulkSmsInput): Promise<BulkSmsResult> {
    return this.request<BulkSmsResult>("/extension/bulk-sms", {
      method: "POST",
      body: input,
    }).then((result) => result.data);
  }

  getReports(): Promise<ReportSummary> {
    return this.request<ReportSummary>("/reports/summary").then(
      (result) => result.data,
    );
  }

  listRulePacks(): Promise<RulePack[]> {
    return this.request<RulePack[]>("/admin/rule-packs").then(
      (result) => result.data,
    );
  }

  getRulePack(id: string): Promise<RulePack> {
    return this.request<RulePack>(
      `/admin/rule-packs/${encodeURIComponent(id)}`,
    ).then((result) => result.data);
  }

  createRulePack(input: RulePackInput): Promise<RulePack> {
    return this.request<RulePack>("/admin/rule-packs", {
      method: "POST",
      body: input,
    }).then((result) => result.data);
  }

  updateRulePack(id: string, yamlDocument: string): Promise<RulePack> {
    return this.request<RulePack>(
      `/admin/rule-packs/${encodeURIComponent(id)}`,
      { method: "PATCH", body: { yaml_document: yamlDocument } },
    ).then((result) => result.data);
  }

  submitRulePackForReview(id: string): Promise<RulePack> {
    return this.request<RulePack>(
      `/admin/rule-packs/${encodeURIComponent(id)}/submit-review`,
      { method: "POST" },
    ).then((result) => result.data);
  }

  approveRulePack(id: string): Promise<RulePack> {
    return this.request<RulePack>(
      `/admin/rule-packs/${encodeURIComponent(id)}/approve`,
      { method: "POST" },
    ).then((result) => result.data);
  }

  publishRulePack(id: string, mfaCode: string): Promise<RulePack> {
    return this.request<RulePack>(
      `/admin/rule-packs/${encodeURIComponent(id)}/publish`,
      { method: "POST", body: { mfa_code: mfaCode } },
    ).then((result) => result.data);
  }

  rollbackRulePack(id: string): Promise<RulePack> {
    return this.request<RulePack>(
      `/admin/rule-packs/${encodeURIComponent(id)}/rollback`,
      { method: "POST" },
    ).then((result) => result.data);
  }

  runGoldenTests(id: string): Promise<RulePack> {
    return this.request<RulePack>(
      `/admin/rule-packs/${encodeURIComponent(id)}/golden-tests`,
      { method: "POST" },
    ).then((result) => result.data);
  }

  simulateRulePack(
    id: string,
    input: RuleSimulationInput,
  ): Promise<RuleSimulationResult> {
    return this.request<RuleSimulationResult>(
      `/admin/rule-packs/${encodeURIComponent(id)}/simulate`,
      { method: "POST", body: input },
    ).then((result) => result.data);
  }

  listAudit(): Promise<AuditEntry[]> {
    return this.request<AuditEntry[]>("/admin/audit-log").then(
      (result) => result.data,
    );
  }

  ussdCallback(input: UssdCallbackRequest): Promise<UssdCallbackResult> {
    return this.request<string>("/ussd/callback", {
      method: "POST",
      body: input,
      rawText: true,
    }).then((result) => ({
      response: result.data,
      session_id: input.session_id,
    }));
  }
}

export const createApiClient = (options: ApiClientOptions = {}) =>
  new NextCropApi(options);
