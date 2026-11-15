import { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";

type UpdateHandler = (reload?: boolean) => Promise<void>;

let updateHandler: UpdateHandler | null = null;
let registrationStarted = false;
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const startPwaRegistration = (onOfflineReady?: () => void): void => {
  if (registrationStarted || !("serviceWorker" in navigator)) return;
  registrationStarted = true;
  updateHandler = registerSW({
    immediate: true,
    onNeedRefresh: notify,
    onOfflineReady,
    onRegisteredSW: (_url, registration) => {
      if (!registration) return;
      window.setInterval(() => {
        void registration.update();
      }, 60 * 60 * 1000);
    },
  });
};

export const applyPwaUpdate = async (): Promise<void> => {
  if (updateHandler) await updateHandler(true);
};

export const usePwaUpdate = (): { needRefresh: boolean; update: () => void } => {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    const listener = () => setNeedRefresh(true);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    needRefresh,
    update: () => {
      void applyPwaUpdate();
    },
  };
};

