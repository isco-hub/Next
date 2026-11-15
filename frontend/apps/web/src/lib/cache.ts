import type {
  FeedbackInput,
  Recommendation,
  RecommendationRequest,
} from "@nextcrop/api-client";

const PLAN_KEY = "nextcrop.lastPlan.v1";
const RECOMMENDATION_QUEUE_KEY = "nextcrop.queue.recommendations.v1";
const FEEDBACK_QUEUE_KEY = "nextcrop.queue.feedback.v1";

export interface CachedPlan {
  recommendation: Recommendation;
  cachedAt: string;
}

export const saveLastPlan = (recommendation: Recommendation): void => {
  const value: CachedPlan = {
    recommendation,
    cachedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(PLAN_KEY, JSON.stringify(value));
  } catch {
    // The server copy is still available when there is a connection.
  }
};

export const readLastPlan = (): CachedPlan | null => {
  try {
    const raw = window.localStorage.getItem(PLAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPlan;
    return parsed.recommendation ? parsed : null;
  } catch {
    return null;
  }
};

export interface QueuedRecommendation {
  id: string;
  createdAt: string;
  attempts: number;
  input: RecommendationRequest;
}

export interface QueuedFeedback {
  id: string;
  createdAt: string;
  attempts: number;
  input: FeedbackInput;
}

const readArray = <T,>(key: string): T[] => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeArray = <T,>(key: string, value: T[]): void => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the in-memory operation working even when storage is full.
  }
};

const makeId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const listQueuedRecommendations = (): QueuedRecommendation[] =>
  readArray<QueuedRecommendation>(RECOMMENDATION_QUEUE_KEY);

export const enqueueRecommendation = (
  input: RecommendationRequest,
): QueuedRecommendation => {
  const item: QueuedRecommendation = {
    id: makeId("queued"),
    createdAt: new Date().toISOString(),
    attempts: 0,
    input,
  };
  writeArray(RECOMMENDATION_QUEUE_KEY, [...listQueuedRecommendations(), item]);
  return item;
};

export const removeQueuedRecommendation = (id: string): void => {
  writeArray(
    RECOMMENDATION_QUEUE_KEY,
    listQueuedRecommendations().filter((item) => item.id !== id),
  );
};

export const markRecommendationAttempt = (id: string): void => {
  writeArray(
    RECOMMENDATION_QUEUE_KEY,
    listQueuedRecommendations().map((item) =>
      item.id === id ? { ...item, attempts: item.attempts + 1 } : item,
    ),
  );
};

export const listQueuedFeedback = (): QueuedFeedback[] =>
  readArray<QueuedFeedback>(FEEDBACK_QUEUE_KEY);

export const enqueueFeedback = (input: FeedbackInput): QueuedFeedback => {
  const item: QueuedFeedback = {
    id: makeId("queuedFeedback"),
    createdAt: new Date().toISOString(),
    attempts: 0,
    input,
  };
  writeArray(FEEDBACK_QUEUE_KEY, [...listQueuedFeedback(), item]);
  return item;
};

export const removeQueuedFeedback = (id: string): void => {
  writeArray(
    FEEDBACK_QUEUE_KEY,
    listQueuedFeedback().filter((item) => item.id !== id),
  );
};

export const clearQueues = (): void => {
  writeArray(RECOMMENDATION_QUEUE_KEY, []);
  writeArray(FEEDBACK_QUEUE_KEY, []);
};
