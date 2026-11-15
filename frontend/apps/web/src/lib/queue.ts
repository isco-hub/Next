import { useEffect, useRef } from "react";
import { useI18n } from "@nextcrop/i18n";
import { api } from "./api";
import {
  listQueuedFeedback,
  listQueuedRecommendations,
  markRecommendationAttempt,
  removeQueuedFeedback,
  removeQueuedRecommendation,
  saveLastPlan,
} from "./cache";
import { useOnline } from "./online";
import { queryClient } from "./query";
import { useToast } from "./toast";

const INTERVAL_MS = 20_000;

export const useOfflineQueue = (): void => {
  const online = useOnline();
  const { t } = useI18n();
  const { showToast } = useToast();
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const flush = async () => {
      if (cancelled || running.current || !navigator.onLine) return;
      running.current = true;
      try {
        for (const item of listQueuedRecommendations()) {
          if (cancelled || !navigator.onLine) break;
          markRecommendationAttempt(item.id);
          try {
            const recommendation = await api.createRecommendation(
              item.input,
              `queue-${item.id}`,
            );
            saveLastPlan(recommendation);
            removeQueuedRecommendation(item.id);
            showToast(t("wizard.queuedReady"), "success");
            void queryClient.invalidateQueries({ queryKey: ["recommendations"] });
          } catch {
            break;
          }
        }

        for (const item of listQueuedFeedback()) {
          if (cancelled || !navigator.onLine) break;
          try {
            await api.submitFeedback(item.input, `queue-${item.id}`);
            removeQueuedFeedback(item.id);
            showToast(t("feedback.queuedSent"), "success");
          } catch {
            break;
          }
        }
      } finally {
        running.current = false;
      }
    };

    void flush();
    const timer = window.setInterval(() => void flush(), INTERVAL_MS);
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [online, showToast, t]);
};
