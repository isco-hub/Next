import {
  CROP_CODES,
  countSmsSegments,
  FLAGS,
  GOALS,
  resolveLocation,
  SOILS,
  type ApiProblem,
  type AssistedRegistrationInput,
  type AssistedRegistrationResult,
  type BulkSmsInput,
  type BulkSmsResult,
  type ConsentInput,
  type ConsentRecord,
  type CropCode,
  type DataRightsSummary,
  type Feedback,
  type FeedbackInput,
  type FieldObservation,
  type FieldObservationInput,
  type Goal,
  type Health,
  type LanguageCode,
  type OfficerSummary,
  type OtpRequestResult,
  type Plot,
  type PlotInput,
  type Recommendation,
  type RecommendationRequest,
  type RecommendationSummary,
  type ReportSummary,
  type Role,
  type RulePack,
  type RulePackInput,
  type RuleSimulationInput,
  type RuleSimulationResult,
  type Session,
  type SoilType,
  type UssdCallbackRequest,
  type UssdCallbackResult,
  type User,
} from "@nextcrop/api-client";
import { HttpResponse, delay, http } from "msw";
import { generateOutlook, type DemoScenario } from "./climate";
import { generatePlan, sampleRequest } from "./engine";
import { OFFICER_CONTACT, SAMPLE_DISCLAIMER } from "./fixtures";
import { runGoldenTests } from "./golden";
import {
  addAudit,
  createSessionForPhone,
  findUserByToken,
  getMockState,
  newId,
  nowIso,
  removeSession,
  saveMockState,
  type MockUssdSession,
  type RegisteredFarmer,
} from "./store";

const V1 = "/v1";
const LATENCY_MS = 90;

const problem = (
  status: number,
  title: string,
  detail?: string,
  errors?: { field: string; message: string }[],
): Response =>
  HttpResponse.json(
    {
      type: `https://nextcrop.example/problems/${status}`,
      title,
      status,
      detail,
      trace_id: `trace-${Math.random().toString(16).slice(2, 10)}`,
      errors,
    } satisfies ApiProblem,
    { status },
  );

const readBody = async <T>(request: Request): Promise<T | null> => {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
};

const tokenOf = (request: Request): string | null => {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
};

type Auth = { user: User; token: string } | { response: Response };

const authorised = (
  request: Request,
  roles?: readonly Role[],
): Auth => {
  const token = tokenOf(request);
  const user = findUserByToken(token);
  if (!token || !user) {
    return { response: problem(401, "Sign in required", "Provide a valid session token.") };
  }
  if (roles && !roles.includes(user.role)) {
    return { response: problem(403, "Not allowed", "Your role cannot use this endpoint.") };
  }
  return { user, token };
};

const isAuthError = (auth: Auth): auth is { response: Response } =>
  "response" in auth;

const numberOrUndefined = (value: string | null): number | undefined => {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const scenarioOf = (request: Request): DemoScenario => {
  const url = new URL(request.url);
  const value =
    request.headers.get("x-demo-scenario") ?? url.searchParams.get("scenario");
  if (value === "dry" || value === "wet" || value === "no_data" || value === "stale") {
    return value;
  }
  return "normal";
};

const locationProblem = () =>
  problem(422, "Location outside supported area", "Choose a location in the Lango sub-region.", [
    { field: "lat/lon", message: "The pin must be inside the Lango sub-region." },
  ]);

const normalisePhone = (value: string): string => {
  const compact = value.replace(/[\s()-]/g, "");
  if (compact.startsWith("+256")) return compact;
  if (compact.startsWith("256")) return `+${compact}`;
  if (compact.startsWith("0")) return `+256${compact.slice(1)}`;
  return compact;
};

const phoneValid = (value: string): boolean => /^\+2567\d{8}$/.test(value);

const summarise = (recommendation: Recommendation): RecommendationSummary => ({
  id: recommendation.id,
  created_at: recommendation.created_at,
  pack_version: recommendation.pack_version,
  crops: recommendation.seasons.map((season) => season.crop),
  season: recommendation.seasons[0]?.season ?? "A",
});

const currentPublished = (): RulePack | undefined =>
  getMockState().rulePacks.find((pack) => pack.status === "published");

const makeRecommendation = (
  input: RecommendationRequest,
  scenario: DemoScenario,
  idempotencyKey?: string,
): Recommendation | Response => {
  const state = getMockState();
  if (idempotencyKey && state.idempotency[idempotencyKey]) {
    const existing = state.recommendations.find(
      (entry) => entry.id === state.idempotency[idempotencyKey],
    );
    if (existing) return existing;
  }
  const location = resolveLocation({
    lat: input.lat,
    lon: input.lon,
    district_id: input.district_id,
    subcounty_id: input.subcounty_id,
  });
  if (!location.inside_region) return locationProblem();
  const pack = currentPublished();
  const outlook = generateOutlook(location, { scenario });
  const plan = generatePlan(
    {
      ...input,
      lat: location.point.lat,
      lon: location.point.lon,
      district_id: location.district.id,
      subcounty_id: location.subcounty.id,
    },
    {
      outlook,
      packVersion: pack?.version ?? "2.0.0",
      startSeason: input.start_season,
    },
  );
  const recommendation: Recommendation = {
    id: newId("rec"),
    pack_version: plan.pack_version,
    created_at: nowIso(),
    channel: input.channel,
    language: input.language,
    inputs: {
      ...input,
      lat: location.point.lat,
      lon: location.point.lon,
      district_id: location.district.id,
      subcounty_id: location.subcounty.id,
    },
    outlook,
    seasons: plan.seasons,
    disclaimer: SAMPLE_DISCLAIMER,
    disclaimer_key: "plan.disclaimerBody",
  };
  state.recommendations.unshift(recommendation);
  if (idempotencyKey) state.idempotency[idempotencyKey] = recommendation.id;
  saveMockState();
  return recommendation;
};

const isRecommendation = (
  value: Recommendation | Response,
): value is Recommendation => "id" in value;

const validateRequest = (
  body: Partial<RecommendationRequest>,
): { value?: RecommendationRequest; response?: Response } => {
  const errors: { field: string; message: string }[] = [];
  const previous = body.previous_crops;
  if (!Array.isArray(previous) || previous.length < 1 || previous.length > 2) {
    errors.push({
      field: "previous_crops",
      message: "Choose one or two previous crops.",
    });
  } else if (previous.some((crop) => !CROP_CODES.some((code) => code === crop))) {
    errors.push({ field: "previous_crops", message: "Unknown crop code." });
  }
  if (!body.soil_type || !SOILS.includes(body.soil_type)) {
    errors.push({ field: "soil_type", message: "Choose a soil type." });
  }
  if (!body.goal || !GOALS.includes(body.goal)) {
    errors.push({ field: "goal", message: "Choose a goal." });
  }
  if (body.flags && body.flags.some((flag) => !FLAGS.includes(flag))) {
    errors.push({ field: "flags", message: "Unknown flag code." });
  }
  if (body.seasons !== undefined && (body.seasons < 2 || body.seasons > 6)) {
    errors.push({ field: "seasons", message: "Choose between 2 and 6 seasons." });
  }
  if (body.language && body.language !== "en") {
    errors.push({ field: "language", message: "English is the only supported language." });
  }
  if (errors.length > 0) {
    return {
      response: problem(422, "Some answers are missing", undefined, errors),
    };
  }
  const value: RecommendationRequest = {
    ...body,
    previous_crops: previous as CropCode[],
    soil_type: body.soil_type as SoilType,
    goal: body.goal as Goal,
    flags: body.flags ?? [],
    seasons: body.seasons ?? 4,
    language: body.language as LanguageCode,
    channel: body.channel ?? "web",
    start_season: body.start_season,
  };
  return { value };
};

const validatePlot = (
  body: Partial<PlotInput>,
): { value?: PlotInput; response?: Response } => {
  const errors: { field: string; message: string }[] = [];
  if (!body.name || body.name.trim().length < 2) {
    errors.push({ field: "name", message: "Give the plot a name." });
  }
  if (typeof body.size_acres !== "number" || body.size_acres < 0.1 || body.size_acres > 100) {
    errors.push({ field: "size_acres", message: "Enter a size between 0.1 and 100 acres." });
  }
  if (typeof body.lat !== "number" || typeof body.lon !== "number") {
    errors.push({ field: "lat/lon", message: "Choose a plot location." });
  }
  if (!body.soil_type || !SOILS.includes(body.soil_type)) {
    errors.push({ field: "soil_type", message: "Choose a soil type." });
  }
  if (!Array.isArray(body.previous_crops) || body.previous_crops.length < 1) {
    errors.push({ field: "previous_crops", message: "Choose the last crop." });
  }
  if (errors.length > 0) {
    return { response: problem(422, "Plot details are incomplete", undefined, errors) };
  }
  const location = resolveLocation({
    lat: body.lat,
    lon: body.lon,
    district_id: body.district_id,
    subcounty_id: body.subcounty_id,
  });
  if (!location.inside_region) return { response: locationProblem() };
  return {
    value: {
      ...body,
      name: body.name!.trim(),
      lat: location.point.lat,
      lon: location.point.lon,
      soil_type: body.soil_type as SoilType,
      size_acres: body.size_acres!,
      previous_crops: body.previous_crops as CropCode[],
      district_id: location.district.id,
      subcounty_id: location.subcounty.id,
    },
  };
};

const summaryFor = (subcountyId: string): OfficerSummary => {
  const state = getMockState();
  const location = resolveLocation({ subcounty_id: subcountyId });
  const outlook = generateOutlook(location);
  const digest = Number.parseInt(
    `${subcountyId}`.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0).toString(),
    10,
  );
  const farmersCount = 38 + (digest % 55);
  const suppressed = farmersCount < 50;
  const cropCounts = new Map<CropCode, number>();
  for (const recommendation of state.recommendations) {
    if (recommendation.inputs.subcounty_id !== subcountyId) continue;
    for (const season of recommendation.seasons) {
      cropCounts.set(season.crop, (cropCounts.get(season.crop) ?? 0) + 1);
    }
  }
  const recommended =
    cropCounts.size > 0
      ? [...cropCounts.entries()]
          .map(([crop, count]) => ({ crop, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      : [
          { crop: "maize" as CropCode, count: 18 },
          { crop: "soya" as CropCode, count: 12 },
          { crop: "groundnut" as CropCode, count: 9 },
          { crop: "sorghum" as CropCode, count: 7 },
        ];
  return {
    district_id: location.district.id,
    subcounty_id: location.subcounty.id,
    subcounty_name: location.subcounty.name,
    farmers_count: farmersCount,
    moisture_class: outlook.moisture_class,
    onset_status: outlook.onset_status,
    updated_at: outlook.computed_at,
    recommended_crops: suppressed ? [] : recommended,
    suppressed,
  };
};

const cropMenu = (): string =>
  "Enter last crop:\n1 Maize\n2 Sorghum\n3 Finger millet\n4 Soya\n5 Groundnut\n6 Bean\n7 Cowpea\n8 Simsim\n9 Sunflower\n10 Cassava";

const soilMenu = (): string =>
  "Soil type:\n1 Sandy\n2 Loam\n3 Clay\n4 Not sure";

const goalMenu = (): string =>
  "Your goal:\n1 Restore soil\n2 More money\n3 Survive dry spells";

const districtMenu = (): string =>
  "District:\n1 Lira\n2 Alebtong\n3 Apac\n4 Oyam\n5 Kole\n6 Dokolo\n7 Amolatar\n8 Otuke\n9 Kwania";

const districtIds = [
  "lira",
  "alebtong",
  "apac",
  "oyam",
  "kole",
  "dokolo",
  "amolatar",
  "otuke",
  "kwania",
];

const cropByNumber: Record<string, CropCode> = {
  "1": "maize",
  "2": "sorghum",
  "3": "finger_millet",
  "4": "soya",
  "5": "groundnut",
  "6": "bean",
  "7": "cowpea",
  "8": "simsim",
  "9": "sunflower",
  "10": "cassava",
};

const soilByNumber: Record<string, SoilType> = {
  "1": "sandy",
  "2": "loam",
  "3": "clay",
  "4": "unknown",
};

const goalByNumber: Record<string, Goal> = {
  "1": "restore_soil",
  "2": "max_cash",
  "3": "drought_survival",
};

const ussdSummary = (recommendation: Recommendation): string => {
  const first = recommendation.seasons[0];
  const second = recommendation.seasons[1];
  if (!first) return "END No plan is available.";
  const firstLabel = first.crop.replace(/_/g, " ");
  const secondLabel = second ? ` Next ${second.season}: ${second.crop.replace(/_/g, " ")}.` : "";
  const warning = first.warnings[0]
    ? ` Warning: ${first.warnings[0].code.replace("plan.warning", "").replace(/([A-Z])/g, " $1").toLowerCase()}.`
    : "";
  return `END ${first.season} ${first.year}: plant ${firstLabel}.${secondLabel}${warning} Guidance only. Ask your extension officer. Ref ${recommendation.id.slice(-6)}`;
};

const subcountyMenu = (districtId: string): string => {
  const district = resolveLocation({ district_id: districtId }).district;
  return `${district.name} sub-counties:\n${district.subcounties
    .map((entry, index) => `${index + 1} ${entry.name}`)
    .join("\n")}`;
};

const ussdSession = (request: UssdCallbackRequest) => {
  const state = getMockState();
  const existing =
    state.ussd[request.session_id] ??
    Object.values(state.ussd).find(
      (session) => session.phone_number === request.phone_number,
    );
  return existing ?? null;
};

const createUssdRecommendation = (
  session: NonNullable<ReturnType<typeof ussdSession>>,
): Recommendation | null => {
  if (!session.previous_crop || !session.soil || !session.goal) return null;
  const districtId = session.district_id ?? "lira";
  const location = resolveLocation({ district_id: districtId });
  const input = sampleRequest({
    previous_crops: [session.previous_crop as CropCode],
    soil_type: session.soil as SoilType,
    goal: session.goal as Goal,
    language: session.language,
    channel: "ussd",
    district_id: location.district.id,
    subcounty_id: location.subcounty.id,
    lat: location.point.lat,
    lon: location.point.lon,
  });
  const result = makeRecommendation(input, "normal");
  return "id" in result ? result : null;
};

export const handlers = [
  http.get(`${V1}/health`, async () => {
    await delay(LATENCY_MS);
    const health: Health = {
      status: "ok",
      data_freshness_hours: 6,
      version: "2.0.0",
      time: nowIso(),
    };
    return HttpResponse.json(health);
  }),

  http.get(`${V1}/outlook`, async ({ request }) => {
    await delay(LATENCY_MS);
    const url = new URL(request.url);
    const location = resolveLocation({
      lat: numberOrUndefined(url.searchParams.get("lat")),
      lon: numberOrUndefined(url.searchParams.get("lon")),
      district_id: url.searchParams.get("district_id") ?? undefined,
      subcounty_id: url.searchParams.get("subcounty_id") ?? undefined,
    });
    if (!location.inside_region) return locationProblem();
    return HttpResponse.json(generateOutlook(location, { scenario: scenarioOf(request) }));
  }),

  http.get(`${V1}/recommendations`, async () => {
    await delay(LATENCY_MS);
    return HttpResponse.json(getMockState().recommendations.map(summarise));
  }),

  http.get(`${V1}/recommendations/:id`, async ({ params }) => {
    await delay(LATENCY_MS);
    const recommendation = getMockState().recommendations.find(
      (entry) => entry.id === params.id,
    );
    if (!recommendation) return problem(404, "Plan not found");
    return HttpResponse.json(recommendation);
  }),

  http.post(`${V1}/recommendations`, async ({ request }) => {
    await delay(LATENCY_MS);
    const body = await readBody<Partial<RecommendationRequest>>(request);
    if (!body) return problem(400, "Invalid JSON body");
    const validation = validateRequest(body);
    if (validation.response) return validation.response;
    const recommendation = makeRecommendation(
      validation.value!,
      scenarioOf(request),
      request.headers.get("idempotency-key") ?? undefined,
    );
    if (!isRecommendation(recommendation)) return recommendation;
    return HttpResponse.json(recommendation, { status: 201 });
  }),

  http.get(`${V1}/plots`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request);
    if (isAuthError(auth)) return auth.response;
    const plots = getMockState().plots.filter((plot) => plot.user_id === auth.user.id);
    return HttpResponse.json(plots);
  }),

  http.post(`${V1}/plots`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request);
    if (isAuthError(auth)) return auth.response;
    const state = getMockState();
    if (state.plots.filter((plot) => plot.user_id === auth.user.id).length >= 5) {
      return problem(409, "Plot limit reached", "Five plots is the current limit.");
    }
    const body = await readBody<Partial<PlotInput>>(request);
    if (!body) return problem(400, "Invalid JSON body");
    const validation = validatePlot(body);
    if (validation.response) return validation.response;
    const location = resolveLocation({
      lat: validation.value!.lat,
      lon: validation.value!.lon,
    });
    const plot: Plot = {
      ...validation.value!,
      id: newId("plot"),
      user_id: auth.user.id,
      grid_cell_id: location.grid_cell_id,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    state.plots.push(plot);
    saveMockState();
    return HttpResponse.json(plot, { status: 201 });
  }),

  http.patch(`${V1}/plots/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request);
    if (isAuthError(auth)) return auth.response;
    const state = getMockState();
    const plot = state.plots.find((entry) => entry.id === params.id);
    if (!plot) return problem(404, "Plot not found");
    if (plot.user_id !== auth.user.id) return problem(403, "Not allowed");
    const body = await readBody<Partial<PlotInput>>(request);
    if (!body) return problem(400, "Invalid JSON body");
    const merged = { ...plot, ...body };
    const validation = validatePlot(merged);
    if (validation.response) return validation.response;
    const location = resolveLocation({
      lat: validation.value!.lat,
      lon: validation.value!.lon,
    });
    Object.assign(plot, validation.value, {
      grid_cell_id: location.grid_cell_id,
      updated_at: nowIso(),
    });
    saveMockState();
    return HttpResponse.json(plot);
  }),

  http.delete(`${V1}/plots/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request);
    if (isAuthError(auth)) return auth.response;
    const state = getMockState();
    const index = state.plots.findIndex((entry) => entry.id === params.id);
    if (index < 0) return problem(404, "Plot not found");
    if (state.plots[index]?.user_id !== auth.user.id) return problem(403, "Not allowed");
    state.plots.splice(index, 1);
    saveMockState();
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${V1}/feedback`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["farmer"]);
    if (isAuthError(auth)) return auth.response;
    const body = await readBody<FeedbackInput>(request);
    if (!body) return problem(400, "Invalid JSON body");
    if (!body.recommendation_id || !CROP_CODES.some((code) => code === body.crop_planted)) {
      return problem(422, "Feedback is incomplete", undefined, [
        { field: "crop_planted", message: "Choose the crop you planted." },
      ]);
    }
    if (body.comment && body.comment.length > 500) {
      return problem(422, "Comment too long", "Keep the comment under 500 characters.");
    }
    const recommendation = getMockState().recommendations.find(
      (entry) => entry.id === body.recommendation_id,
    );
    if (!recommendation) return problem(404, "Plan not found");
    const ruleIds = recommendation.seasons
      .filter((season) => season.season === body.season)
      .flatMap((season) => season.rule_ids);
    const entry: Feedback = {
      ...body,
      id: newId("feedback"),
      created_at: nowIso(),
      rule_ids: ruleIds,
    };
    getMockState().feedback.unshift(entry);
    saveMockState();
    return HttpResponse.json(entry, { status: 201 });
  }),

  http.post(`${V1}/auth/otp/request`, async ({ request }) => {
    await delay(LATENCY_MS);
    const body = await readBody<{ phone?: string }>(request);
    const phone = normalisePhone(body?.phone ?? "");
    if (!phoneValid(phone)) {
      return problem(422, "Enter a valid Ugandan phone number", undefined, [
        { field: "phone", message: "Use a number such as 0770 000 000." },
      ]);
    }
    const result: OtpRequestResult = {
      request_id: `otp_${phone}`,
      expires_in_seconds: 300,
      channel: "sms",
    };
    return HttpResponse.json(result);
  }),

  http.post(`${V1}/auth/otp/verify`, async ({ request }) => {
    await delay(LATENCY_MS);
    const body = await readBody<{ request_id?: string; code?: string }>(request);
    const phone = body?.request_id?.replace(/^otp_/, "") ?? "";
    if (!body?.request_id || !phoneValid(phone)) {
      return problem(422, "Request a new code", "The verification request is unknown.");
    }
    if (body.code !== "123456") {
      return problem(401, "Incorrect code", "Use the demo code 123456.");
    }
    const session: Session = createSessionForPhone(phone);
    return HttpResponse.json(session);
  }),

  http.post(`${V1}/auth/refresh`, async () => {
    await delay(LATENCY_MS);
    return problem(401, "Sign in again", "The sample API cannot refresh sessions.");
  }),

  http.get(`${V1}/auth/me`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request);
    if (isAuthError(auth)) return auth.response;
    return HttpResponse.json(auth.user);
  }),

  http.delete(`${V1}/auth/session`, async ({ request }) => {
    await delay(LATENCY_MS);
    removeSession(tokenOf(request));
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${V1}/auth/consent`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request);
    if (isAuthError(auth)) return auth.response;
    const body = await readBody<ConsentInput>(request);
    if (!body || !body.version || !Array.isArray(body.channels)) {
      return problem(422, "Consent details are incomplete");
    }
    const record: ConsentRecord = {
      id: newId("consent"),
      user_id: auth.user.id,
      version: body.version,
      channels: body.channels,
      data_sharing: Boolean(body.data_sharing),
      language: body.language,
      accepted_at: nowIso(),
      withdrawn_at: null,
    };
    auth.user.consent_version = body.version;
    auth.user.language = body.language;
    getMockState().consents.unshift(record);
    saveMockState();
    return HttpResponse.json(record, { status: 201 });
  }),

  http.get(`${V1}/auth/me/data-rights`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request);
    if (isAuthError(auth)) return auth.response;
    const state = getMockState();
    const summary: DataRightsSummary = {
      user: auth.user,
      plots: state.plots.filter((plot) => plot.user_id === auth.user.id),
      recommendations: state.recommendations.map(summarise),
      consents: state.consents.filter((consent) => consent.user_id === auth.user.id),
    };
    return HttpResponse.json(summary);
  }),

  http.delete(`${V1}/auth/me`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request);
    if (isAuthError(auth)) return auth.response;
    const state = getMockState();
    state.plots = state.plots.filter((plot) => plot.user_id !== auth.user.id);
    state.consents = state.consents.filter((consent) => consent.user_id !== auth.user.id);
    auth.user.consent_version = null;
    addAudit(auth.user.id, "data.delete", auth.user.id, "Farmer exercised the right to erasure.");
    saveMockState();
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${V1}/extension/summary`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, [
      "extension_officer",
      "cooperative",
      "agronomist",
      "admin",
    ]);
    if (isAuthError(auth)) return auth.response;
    const url = new URL(request.url);
    const subcountyId =
      url.searchParams.get("subcounty_id") ??
      auth.user.subcounty_ids[0] ??
      "lira.lira";
    return HttpResponse.json(summaryFor(subcountyId));
  }),

  http.post(`${V1}/extension/register`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["extension_officer", "admin", "cooperative"]);
    if (isAuthError(auth)) return auth.response;
    const body = await readBody<AssistedRegistrationInput>(request);
    if (!body?.consent) {
      return problem(422, "Consent is required", "Record the farmer's consent before saving.");
    }
    const phone = normalisePhone(body.phone);
    if (!phoneValid(phone)) return problem(422, "Enter a valid phone number");
    if (!body.farmer_name || !body.plot) {
      return problem(422, "Farmer details are incomplete");
    }
    const validation = validatePlot({
      ...body.plot,
      district_id: body.subcounty_id.split(".")[0],
      subcounty_id: body.subcounty_id,
    });
    if (validation.response) return validation.response;
    const state = getMockState();
    const farmerRef = `F-${1100 + state.registeredFarmers.length}`;
    const farmer: RegisteredFarmer = {
      farmer_ref: farmerRef,
      name: body.farmer_name,
      phone,
      language: body.language,
      subcounty_id: body.subcounty_id,
      created_at: nowIso(),
      created_by: auth.user.id,
    };
    const location = resolveLocation({
      lat: validation.value!.lat,
      lon: validation.value!.lon,
    });
    const plot: Plot = {
      ...validation.value!,
      id: newId("plot"),
      user_id: farmerRef,
      grid_cell_id: location.grid_cell_id,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    state.registeredFarmers.push(farmer);
    state.plots.push(plot);
    addAudit(auth.user.id, "farmer.register", farmerRef, "Assisted registration with consent.");
    saveMockState();
    const result: AssistedRegistrationResult = {
      farmer_ref: farmerRef,
      plot_id: plot.id,
      consent_version: "2026-01",
      message: "Farmer registered. An SMS will confirm the nearest climate grid.",
    };
    return HttpResponse.json(result, { status: 201 });
  }),

  http.get(`${V1}/extension/observations`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["extension_officer", "admin", "cooperative"]);
    if (isAuthError(auth)) return auth.response;
    return HttpResponse.json(getMockState().observations);
  }),

  http.post(`${V1}/extension/observations`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["extension_officer", "admin", "cooperative"]);
    if (isAuthError(auth)) return auth.response;
    const body = await readBody<FieldObservationInput>(request);
    if (!body || !CROP_CODES.some((code) => code === body.crop_planted)) {
      return problem(422, "Observation is incomplete");
    }
    const observation: FieldObservation = {
      id: newId("obs"),
      officer_id: auth.user.id,
      plot_id: body.plot_id ?? null,
      farmer_ref: body.farmer_ref ?? null,
      crop_planted: body.crop_planted,
      pest_sighting: body.pest_sighting ?? null,
      disease_sighting: body.disease_sighting ?? null,
      note: body.note ?? null,
      observed_at: nowIso(),
    };
    getMockState().observations.unshift(observation);
    saveMockState();
    return HttpResponse.json(observation, { status: 201 });
  }),

  http.post(`${V1}/extension/bulk-sms`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["extension_officer", "admin", "cooperative"]);
    if (isAuthError(auth)) return auth.response;
    const body = await readBody<BulkSmsInput>(request);
    if (!body?.message) return problem(422, "Message is required");
    if (body.message.length > 480) {
      return problem(422, "Message too long", "Keep bulk SMS under 480 characters.");
    }
    const counts = countSmsSegments(body.message);
    const recipients = 143;
    const result: BulkSmsResult = {
      recipients,
      suppressed: 4,
      encoding: counts.encoding,
      segments_per_message: counts.segments,
      total_segments: counts.segments * recipients,
    };
    return HttpResponse.json(result);
  }),

  http.get(`${V1}/reports/summary`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["extension_officer", "agronomist", "admin"]);
    if (isAuthError(auth)) return auth.response;
    const state = getMockState();
    const channelCounts = new Map<string, number>();
    for (const recommendation of state.recommendations) {
      channelCounts.set(
        recommendation.channel,
        (channelCounts.get(recommendation.channel) ?? 0) + 1,
      );
    }
    const ruleStats = new Map<string, { crop: CropCode; followed: number; total: number }>();
    for (const entry of state.feedback) {
      for (const ruleId of entry.rule_ids) {
        const current = ruleStats.get(ruleId) ?? {
          crop: entry.crop_planted,
          followed: 0,
          total: 0,
        };
        current.total += 1;
        if (entry.followed) current.followed += 1;
        ruleStats.set(ruleId, current);
      }
    }
    const summary: ReportSummary = {
      generated_at: nowIso(),
      suppressed: false,
      usage_by_channel: [...channelCounts.entries()].map(([channel, count]) => ({
        channel: channel as ReportSummary["usage_by_channel"][number]["channel"],
        count,
      })),
      adoption_funnel: [
        { stage: "plans_created", count: state.recommendations.length },
        { stage: "feedback_started", count: state.feedback.length + 3 },
        { stage: "feedback_submitted", count: state.feedback.length },
        {
          stage: "plan_followed",
          count: state.feedback.filter((entry) => entry.followed).length,
        },
      ],
      follow_rate_by_rule: [...ruleStats.entries()]
        .map(([ruleId, stats]) => ({
          rule_id: ruleId,
          crop: stats.crop,
          follow_rate: stats.total > 0 ? stats.followed / stats.total : 0,
          sample_size: stats.total,
        }))
        .slice(0, 12),
    };
    return HttpResponse.json(summary);
  }),

  http.get(`${V1}/admin/rule-packs`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["agronomist", "admin"]);
    if (isAuthError(auth)) return auth.response;
    return HttpResponse.json(getMockState().rulePacks);
  }),

  http.get(`${V1}/admin/rule-packs/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["agronomist", "admin"]);
    if (isAuthError(auth)) return auth.response;
    const pack = getMockState().rulePacks.find((entry) => entry.id === params.id);
    if (!pack) return problem(404, "Rule pack not found");
    return HttpResponse.json(pack);
  }),

  http.post(`${V1}/admin/rule-packs`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["agronomist", "admin"]);
    if (isAuthError(auth)) return auth.response;
    const body = await readBody<RulePackInput>(request);
    if (!body?.version || !body.yaml_document) {
      return problem(422, "Version and YAML are required");
    }
    const state = getMockState();
    if (state.rulePacks.some((pack) => pack.version === body.version)) {
      return problem(409, "Version already exists", "Choose a new rule pack version.");
    }
    const pack: RulePack = {
      id: newId("rp"),
      version: body.version,
      status: "draft",
      yaml_document: body.yaml_document,
      created_by: auth.user.id,
      created_at: nowIso(),
      updated_at: nowIso(),
      approved_by: null,
      published_at: null,
      pack_hash: `draft-${body.version}`,
      golden_tests_passed: false,
      golden_tests: [],
      base_version: body.base_version ?? null,
    };
    state.rulePacks.unshift(pack);
    addAudit(auth.user.id, "rulepack.create", body.version, "Created a draft rule pack.");
    saveMockState();
    return HttpResponse.json(pack, { status: 201 });
  }),

  http.patch(`${V1}/admin/rule-packs/:id`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["agronomist", "admin"]);
    if (isAuthError(auth)) return auth.response;
    const pack = getMockState().rulePacks.find((entry) => entry.id === params.id);
    if (!pack) return problem(404, "Rule pack not found");
    if (pack.status === "published") {
      return problem(409, "Published packs are immutable", "Create a draft version instead.");
    }
    const body = await readBody<{ yaml_document?: string }>(request);
    if (!body?.yaml_document) return problem(422, "YAML is required");
    pack.yaml_document = body.yaml_document;
    pack.updated_at = nowIso();
    pack.status = "draft";
    pack.golden_tests_passed = false;
    addAudit(auth.user.id, "rulepack.update", pack.version, "Updated YAML and re-opened review.");
    saveMockState();
    return HttpResponse.json(pack);
  }),

  http.post(`${V1}/admin/rule-packs/:id/submit-review`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["agronomist", "admin"]);
    if (isAuthError(auth)) return auth.response;
    const pack = getMockState().rulePacks.find((entry) => entry.id === params.id);
    if (!pack) return problem(404, "Rule pack not found");
    if (pack.status !== "draft" && pack.status !== "in_review") {
      return problem(409, "Pack cannot be reviewed", "Only a draft can be submitted.");
    }
    if (!pack.golden_tests_passed) {
      return problem(409, "Golden tests have not passed", "Run the golden tests first.");
    }
    pack.status = "in_review";
    pack.updated_at = nowIso();
    addAudit(auth.user.id, "rulepack.review", pack.version, "Submitted to a second reviewer.");
    saveMockState();
    return HttpResponse.json(pack);
  }),

  http.post(`${V1}/admin/rule-packs/:id/approve`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["admin"]);
    if (isAuthError(auth)) return auth.response;
    const pack = getMockState().rulePacks.find((entry) => entry.id === params.id);
    if (!pack) return problem(404, "Rule pack not found");
    if (pack.status !== "in_review") {
      return problem(409, "Pack is not in review", "Only an in-review pack can be approved.");
    }
    if (pack.created_by === auth.user.id) {
      return problem(409, "Maker-checker required", "Another person must approve this pack.");
    }
    pack.status = "approved";
    pack.approved_by = auth.user.id;
    pack.updated_at = nowIso();
    addAudit(auth.user.id, "rulepack.approve", pack.version, "Second-person approval recorded.");
    saveMockState();
    return HttpResponse.json(pack);
  }),

  http.post(`${V1}/admin/rule-packs/:id/publish`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["admin"]);
    if (isAuthError(auth)) return auth.response;
    const pack = getMockState().rulePacks.find((entry) => entry.id === params.id);
    if (!pack) return problem(404, "Rule pack not found");
    if (pack.status !== "approved") {
      return problem(409, "Pack is not approved", "Approve the pack before publishing.");
    }
    const body = await readBody<{ mfa_code?: string }>(request);
    if (body?.mfa_code !== "123456") {
      return problem(401, "MFA code required", "Use the demo MFA code 123456.");
    }
    const state = getMockState();
    for (const existing of state.rulePacks) {
      if (existing.status === "published") {
        existing.status = "archived";
        existing.updated_at = nowIso();
      }
    }
    pack.status = "published";
    pack.published_at = nowIso();
    pack.updated_at = nowIso();
    addAudit(auth.user.id, "rulepack.publish", pack.version, "Published with MFA and audit.");
    saveMockState();
    return HttpResponse.json(pack);
  }),

  http.post(`${V1}/admin/rule-packs/:id/rollback`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["admin"]);
    if (isAuthError(auth)) return auth.response;
    const pack = getMockState().rulePacks.find((entry) => entry.id === params.id);
    if (!pack) return problem(404, "Rule pack not found");
    if (pack.status !== "published") {
      return problem(409, "Pack is not published");
    }
    const base = getMockState().rulePacks.find(
      (entry) => entry.version === pack.base_version,
    );
    pack.status = "archived";
    pack.published_at = null;
    pack.updated_at = nowIso();
    if (base && base.status === "archived") {
      base.status = "published";
      base.published_at = nowIso();
    }
    addAudit(auth.user.id, "rulepack.rollback", pack.version, "Rolled back to base version.");
    saveMockState();
    return HttpResponse.json(base ?? pack);
  }),

  http.post(`${V1}/admin/rule-packs/:id/golden-tests`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["agronomist", "admin"]);
    if (isAuthError(auth)) return auth.response;
    const pack = getMockState().rulePacks.find((entry) => entry.id === params.id);
    if (!pack) return problem(404, "Rule pack not found");
    pack.golden_tests = runGoldenTests();
    pack.golden_tests_passed = pack.golden_tests.every((test) => test.pass);
    pack.updated_at = nowIso();
    addAudit(
      auth.user.id,
      "rulepack.golden_tests",
      pack.version,
      pack.golden_tests_passed ? "All golden tests passed." : "Golden tests failed.",
    );
    saveMockState();
    return HttpResponse.json(pack);
  }),

  http.post(`${V1}/admin/rule-packs/:id/simulate`, async ({ request, params }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["agronomist", "admin"]);
    if (isAuthError(auth)) return auth.response;
    const pack = getMockState().rulePacks.find((entry) => entry.id === params.id);
    if (!pack) return problem(404, "Rule pack not found");
    const body = await readBody<RuleSimulationInput>(request);
    if (!body) return problem(400, "Invalid JSON body");
    const input = { ...sampleRequest(), ...body };
    const plan = generatePlan(input, {
      packVersion: pack.version,
      startSeason: input.start_season,
      now: new Date(),
    });
    const result: RuleSimulationResult = {
      pack_version: pack.version,
      seasons: plan.seasons,
      trace: plan.trace,
    };
    return HttpResponse.json(result);
  }),

  http.get(`${V1}/admin/audit-log`, async ({ request }) => {
    await delay(LATENCY_MS);
    const auth = authorised(request, ["agronomist", "admin"]);
    if (isAuthError(auth)) return auth.response;
    return HttpResponse.json(getMockState().audit);
  }),

  http.post(`${V1}/ussd/callback`, async ({ request }) => {
    await delay(LATENCY_MS);
    const body = await readBody<UssdCallbackRequest>(request);
    if (!body) return HttpResponse.text("END Invalid request.");
    const state = getMockState();
    const session: MockUssdSession =
      ussdSession(body) ?? {
        session_id: body.session_id,
        phone_number: normalisePhone(body.phone_number),
        language: "en" as LanguageCode,
        step: "menu",
        updated_at: nowIso(),
      };
    const parts = body.text.split("*").filter(Boolean);
    const input = parts[parts.length - 1] ?? "";
    let responseText = "";

    if (session.step === "menu") {
      if (input === "1") {
        session.step = "crop";
        responseText = `CON ${cropMenu()}`;
      } else if (input === "2") {
        const latest = state.recommendations[0];
        responseText = latest ? ussdSummary(latest) : "END No saved plan yet.";
      } else if (input === "3") {
        session.step = "district";
        responseText = `CON ${districtMenu()}`;
      } else if (input === "4") {
        if (!state.recommendations[0]) {
          responseText = "END No plan is available for feedback.";
        } else {
          session.step = "feedback_crop";
          session.recommendation_id = state.recommendations[0].id;
          responseText = `CON ${cropMenu()}`;
        }
      } else if (input === "5") {
        responseText = `END ${OFFICER_CONTACT}`;
      } else {
        responseText =
          "CON Choose 1 to 5.\n1 Get crop advice\n2 My last plan\n3 Change district\n4 Send feedback\n5 Help";
      }
    } else if (session.step === "crop") {
      const crop = cropByNumber[input];
      if (!crop) {
        responseText = `CON ${cropMenu()}`;
      } else {
        session.previous_crop = crop;
        session.step = "soil";
        responseText = `CON ${soilMenu()}`;
      }
    } else if (session.step === "soil") {
      const soil = soilByNumber[input];
      if (!soil) {
        responseText = `CON ${soilMenu()}`;
      } else {
        session.soil = soil;
        session.step = "goal";
        responseText = `CON ${goalMenu()}`;
      }
    } else if (session.step === "goal") {
      const goal = goalByNumber[input];
      if (!goal) {
        responseText = `CON ${goalMenu()}`;
      } else {
        session.goal = goal;
        if (session.district_id) {
          const recommendation = createUssdRecommendation(session);
          responseText = recommendation
            ? ussdSummary(recommendation)
            : "END We could not build a plan. Try again later.";
        } else {
          session.step = "district";
          responseText = `CON ${districtMenu()}`;
        }
      }
    } else if (session.step === "district") {
      const districtId = districtIds[Number(input) - 1];
      if (!districtId) {
        responseText = `CON ${districtMenu()}`;
      } else {
        session.district_id = districtId;
        session.step = "subcounty";
        responseText = `CON ${subcountyMenu(districtId)}`;
      }
    } else if (session.step === "subcounty") {
      const district = resolveLocation({ district_id: session.district_id }).district;
      const chosen = district.subcounties[Number(input) - 1];
      if (!chosen) {
        responseText = `CON ${subcountyMenu(district.id)}`;
      } else {
        session.district_id = chosen.district_id;
        const location = resolveLocation({ subcounty_id: chosen.id });
        session.district_id = location.district.id;
        session.step = "goal";
        session.goal = session.goal ?? "restore_soil";
        const recommendation = createUssdRecommendation(session);
        responseText = recommendation
          ? ussdSummary(recommendation)
          : "END We could not build a plan. Try again later.";
      }
    } else if (session.step === "feedback_crop") {
      const crop = cropByNumber[input];
      if (!crop) {
        responseText = `CON ${cropMenu()}`;
      } else {
        session.previous_crop = crop;
        session.step = "feedback_rating";
        responseText = "CON How did it compare?\n1 Better\n2 Same\n3 Worse";
      }
    } else if (session.step === "feedback_rating") {
      const rating =
        input === "1" ? "better" : input === "2" ? "same" : input === "3" ? "worse" : null;
      if (!rating) {
        responseText = "CON How did it compare?\n1 Better\n2 Same\n3 Worse";
      } else {
        const recommendation = state.recommendations.find(
          (entry) => entry.id === session.recommendation_id,
        );
        if (recommendation && session.previous_crop) {
          const entry: Feedback = {
            id: newId("feedback"),
            recommendation_id: recommendation.id,
            season: recommendation.seasons[0]?.season ?? "A",
            followed: true,
            crop_planted: session.previous_crop as CropCode,
            rating,
            thumbs: "up",
            reason_code: undefined,
            comment: "",
            created_at: nowIso(),
            rule_ids: recommendation.seasons[0]?.rule_ids ?? [],
          };
          state.feedback.unshift(entry);
        }
        responseText = "END Thank you. Your feedback helps the next plan.";
      }
    }

    session.updated_at = nowIso();
    state.ussd[session.session_id] = session;
    saveMockState();
    const result: UssdCallbackResult = {
      response: responseText,
      session_id: body.session_id,
    };
    return HttpResponse.text(result.response);
  }),
];

export const contractPaths = [
  "GET /v1/health",
  "GET /v1/outlook",
  "GET /v1/recommendations",
  "POST /v1/recommendations",
  "GET /v1/recommendations/:id",
  "GET /v1/plots",
  "POST /v1/plots",
  "PATCH /v1/plots/:id",
  "DELETE /v1/plots/:id",
  "POST /v1/feedback",
  "POST /v1/auth/otp/request",
  "POST /v1/auth/otp/verify",
  "DELETE /v1/auth/session",
  "POST /v1/auth/consent",
  "GET /v1/auth/me/data-rights",
  "DELETE /v1/auth/me",
  "GET /v1/extension/summary",
  "POST /v1/extension/register",
  "GET /v1/extension/observations",
  "POST /v1/extension/observations",
  "POST /v1/extension/bulk-sms",
  "GET /v1/reports/summary",
  "GET /v1/admin/rule-packs",
  "POST /v1/admin/rule-packs",
  "PATCH /v1/admin/rule-packs/:id",
  "GET /v1/admin/rule-packs/:id",
  "POST /v1/admin/rule-packs/:id/submit-review",
  "POST /v1/admin/rule-packs/:id/approve",
  "POST /v1/admin/rule-packs/:id/publish",
  "POST /v1/admin/rule-packs/:id/rollback",
  "POST /v1/admin/rule-packs/:id/golden-tests",
  "POST /v1/admin/rule-packs/:id/simulate",
  "GET /v1/admin/audit-log",
  "POST /v1/ussd/callback",
];
