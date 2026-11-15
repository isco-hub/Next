import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, NextCropApi } from "./client";

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "x-trace-id": "trace-9" },
  });

const makeApi = (fetchImpl: typeof fetch, retries = 0) =>
  new NextCropApi({
    baseUrl: "https://api.example.test/v1/",
    fetchImpl,
    getToken: () => "token-1",
    retries,
    retryDelayMs: 0,
  });

afterEach(() => {
  vi.useRealTimers();
});

describe("NextCropApi", () => {
  it("calls every endpoint with the expected method, auth and idempotency headers", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init: init ?? {} });
      if (url.endsWith("/ussd/callback")) return new Response("CON Welcome", { status: 200 });
      if (url.endsWith("/me/data") || url.endsWith("/plots/p1") || url.endsWith("/auth/session")) {
        return new Response(null, { status: 204 });
      }
      return json({ ok: true, id: "id-1" });
    }) as unknown as typeof fetch;
    const api = makeApi(fetchImpl);

    await api.health();
    await api.getOutlook({ lat: 2.25, lon: 32.85, district_id: "", subcounty_id: "sc-1" });
    await api.createRecommendation(
      { previous_crops: [], soil_type: "loam", goal: "max_cash", language: "en", channel: "web" },
      "idem-1",
    );
    await api.getRecommendation("rec/1");
    await api.listPlots();
    await api.createPlot({ name: "Plot", lat: 1, lon: 2, soil_type: "loam", size_acres: 1, previous_crops: [] });
    await api.updatePlot("p1", { name: "Updated" });
    await api.deletePlot("p1");
    await api.listRecommendations();
    await api.submitFeedback(
      { recommendation_id: "r1", season: "A", followed: true, crop_planted: "maize" },
      "fb-1",
    );
    await api.requestOtp("+256770000003");
    await api.verifyOtp("req-1", "123456");
    await api.signOut();
    await api.createConsent({ version: "1", channels: ["web"], data_sharing: false, language: "en" });
    await api.getDataRights();
    await api.deleteMyData();
    await api.getOfficerSummary("sc-1");
    await api.assistedRegistration({ farmer_name: "A", phone: "+256770000003", language: "en", subcounty_id: "sc-1", consent: true, plot: { name: "Plot", lat: 1, lon: 2, soil_type: "loam", size_acres: 1, previous_crops: [] } });
    await api.listObservations();
    await api.createObservation({ farmer_ref: "f1", crop_planted: "maize", note: "ok" });
    await api.sendBulkSms({ subcounty_id: "sc-1", message: "hello", language: "en" });
    await api.getReports();
    await api.listRulePacks();
    await api.getRulePack("pack/1");
    await api.createRulePack({ version: "1.4.1", yaml_document: "pack: {}" });
    await api.updateRulePack("pack-1", "pack: {}");
    await api.submitRulePackForReview("pack-1");
    await api.approveRulePack("pack-1");
    await api.publishRulePack("pack-1", "123456");
    await api.rollbackRulePack("pack-1");
    await api.runGoldenTests("pack-1");
    await api.simulateRulePack("pack-1", { previous_crops: [], soil_type: "loam", goal: "max_cash", language: "en", channel: "web" });
    await api.listAudit();
    const ussd = await api.ussdCallback({ session_id: "s1", service_code: "*384*2026#", phone_number: "+256770000003", text: "1", network_code: "MTN" });

    expect(ussd).toEqual({ response: "CON Welcome", session_id: "s1" });
    expect(calls).toHaveLength(34);
    expect(calls[1]?.url).toBe("https://api.example.test/v1/outlook?lat=2.25&lon=32.85&subcounty_id=sc-1");
    expect(calls[2]?.url).toBe("https://api.example.test/v1/recommendations");
    expect(calls[2]?.init.headers).toMatchObject({
      Authorization: "Bearer token-1",
      "Idempotency-Key": "idem-1",
      "Content-Type": "application/json",
    });
    expect(calls[0]?.init.credentials).toBe("include");
    expect(calls[3]?.url).toContain("/recommendations/rec%2F1");
    const feedbackCall = calls.find((call) => call.url.endsWith("/feedback"));
    expect(feedbackCall?.init.headers).toMatchObject({ "Idempotency-Key": "fb-1" });
  });

  it("maps API problems, trace ids and field errors", async () => {
    const fetchImpl = vi.fn(async () =>
      json(
        {
          type: "about:blank",
          title: "Validation failed",
          status: 422,
          detail: "Check the highlighted fields.",
          trace_id: "problem-trace",
          errors: [{ field: "lat", message: "Out of area" }],
        },
        422,
      ),
    ) as unknown as typeof fetch;
    const api = makeApi(fetchImpl);

    const error = await api.health().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, traceId: "trace-9" });
    expect((error as ApiError).fieldErrors).toEqual([{ field: "lat", message: "Out of area" }]);
  });

  it("retries retryable GET failures and then succeeds", async () => {
    let attempts = 0;
    const fetchImpl = vi.fn(async () => {
      attempts += 1;
      return attempts === 1 ? json({ title: "Busy" }, 503) : json({ status: "ok" });
    }) as unknown as typeof fetch;
    const api = makeApi(fetchImpl, 1);

    await expect(api.health()).resolves.toEqual({ status: "ok" });
    expect(attempts).toBe(2);
  });

  it("does not retry non-idempotent writes", async () => {
    const fetchImpl = vi.fn(async () => json({ title: "Busy" }, 503)) as unknown as typeof fetch;
    const api = makeApi(fetchImpl, 3);

    await expect(
      api.createPlot({ name: "Plot", lat: 1, lon: 2, soil_type: "loam", size_acres: 1, previous_crops: [] }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("wraps transport failures as network errors", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("socket closed");
    }) as unknown as typeof fetch;
    const api = makeApi(fetchImpl, 1);

    const error = await api.health().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).isNetworkError).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reads raw USSD text and surfaces raw error bodies", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("END Session closed", { status: 200 }))
      .mockResolvedValueOnce(new Response("upstream down", { status: 500 }))
      .mockResolvedValueOnce(new Response("not-json", { status: 200, headers: { "content-type": "text/plain" } })) as unknown as typeof fetch;
    const api = makeApi(fetchImpl);

    await expect(
      api.ussdCallback({ session_id: "s1", service_code: "*384*2026#", phone_number: "+256", text: "", network_code: "MTN" }),
    ).resolves.toMatchObject({ response: "END Session closed" });
    await expect(
      api.ussdCallback({ session_id: "s1", service_code: "*384*2026#", phone_number: "+256", text: "", network_code: "MTN" }),
    ).rejects.toMatchObject({ message: "upstream down", status: 500 });
    await expect(api.health()).resolves.toBe("not-json");
  });

  it("times out stalled requests without retrying them", async () => {
    const fetchImpl = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    ) as unknown as typeof fetch;
    const api = new NextCropApi({ fetchImpl, retries: 0, timeoutMs: 1 });

    const error = await api.health().catch((value: unknown) => value);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
