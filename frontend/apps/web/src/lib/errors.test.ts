import { describe, expect, it } from "vitest";
import { ApiError } from "@nextcrop/api-client";
import { errorMessage } from "./errors";

const t = (key: string) => key;

describe("errorMessage", () => {
  it("maps API status codes to translated messages", () => {
    expect(errorMessage(new ApiError("offline", 0), t)).toBe("errors.network");
    expect(errorMessage(new ApiError("no", 401), t)).toBe("errors.unauthorized");
    expect(errorMessage(new ApiError("no", 403), t)).toBe("errors.forbidden");
    expect(errorMessage(new ApiError("no", 404), t)).toBe("errors.notFound");
    expect(errorMessage(new ApiError("no", 429), t)).toBe("errors.rateLimited");
    expect(errorMessage(new ApiError("no", 503), t)).toBe("errors.server");
  });

  it("uses a problem detail before a generic title", () => {
    const error = new ApiError("bad", 422, {
      type: "about:blank",
      title: "Validation",
      status: 422,
      detail: "The plot is too large.",
      trace_id: "trace-1",
    });
    expect(errorMessage(error, t)).toBe("The plot is too large.");
  });

  it("maps aborts and unknown errors", () => {
    const abort = new Error("stop");
    abort.name = "AbortError";
    expect(errorMessage(abort, t)).toBe("errors.timeout");
    expect(errorMessage("unexpected", t)).toBe("errors.server");
  });
});
