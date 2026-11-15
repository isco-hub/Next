import type { FeedbackInput, Recommendation } from "@nextcrop/api-client";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearQueues,
  enqueueFeedback,
  enqueueRecommendation,
  listQueuedFeedback,
  listQueuedRecommendations,
  markRecommendationAttempt,
  readLastPlan,
  removeQueuedFeedback,
  removeQueuedRecommendation,
  saveLastPlan,
} from "./cache";

const recommendation = { id: "rec-1" } as Recommendation;
const feedback: FeedbackInput = {
  recommendation_id: "rec-1",
  season: "A",
  followed: true,
  crop_planted: "maize",
};

beforeEach(() => {
  window.localStorage.clear();
});

describe("offline cache", () => {
  it("stores the last plan and rejects corrupt entries", () => {
    expect(readLastPlan()).toBeNull();
    saveLastPlan(recommendation);
    expect(readLastPlan()?.recommendation.id).toBe("rec-1");
    window.localStorage.setItem("nextcrop.lastPlan.v1", '{"cachedAt":"x"}');
    expect(readLastPlan()).toBeNull();
  });

  it("queues recommendations, tracks attempts and removes them", () => {
    const item = enqueueRecommendation({
      previous_crops: [],
      soil_type: "loam",
      goal: "max_cash",
      language: "en",
      channel: "web",
    });
    expect(listQueuedRecommendations()).toHaveLength(1);
    markRecommendationAttempt(item.id);
    expect(listQueuedRecommendations()[0]?.attempts).toBe(1);
    removeQueuedRecommendation(item.id);
    expect(listQueuedRecommendations()).toEqual([]);
  });

  it("queues feedback and clears both queues", () => {
    expect(listQueuedFeedback()).toEqual([]);
    const item = enqueueFeedback(feedback);
    expect(listQueuedFeedback()[0]?.input.recommendation_id).toBe("rec-1");
    removeQueuedFeedback(item.id);
    expect(listQueuedFeedback()).toEqual([]);
    enqueueFeedback(feedback);
    enqueueRecommendation({
      previous_crops: [],
      soil_type: "loam",
      goal: "max_cash",
      language: "en",
      channel: "web",
    });
    clearQueues();
    expect(listQueuedFeedback()).toEqual([]);
    expect(listQueuedRecommendations()).toEqual([]);
  });

  it("tolerates corrupt queue storage", () => {
    window.localStorage.setItem("nextcrop.queue.recommendations.v1", "oops");
    window.localStorage.setItem("nextcrop.queue.feedback.v1", '{"not":"array"}');
    expect(listQueuedRecommendations()).toEqual([]);
    expect(listQueuedFeedback()).toEqual([]);
  });
});
