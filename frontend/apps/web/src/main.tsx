import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@nextcrop/i18n";
import { BrowserRouter } from "react-router-dom";
import "./styles/app.css";
import { App } from "./App";
import { demoMode } from "./lib/api";
import { AuthProvider } from "./lib/auth";
import { PrefsProvider } from "./lib/prefs";
import { startPwaRegistration } from "./lib/pwa";
import { queryClient } from "./lib/query";
import { ToastProvider } from "./lib/toast";

const render = () => {
  const container = document.getElementById("root");
  if (!container) throw new Error("Missing root element");
  createRoot(container).render(
    <StrictMode>
      <I18nProvider>
        <PrefsProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ToastProvider>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </ToastProvider>
            </AuthProvider>
          </QueryClientProvider>
        </PrefsProvider>
      </I18nProvider>
    </StrictMode>,
  );
};

const stopSampleApi = async () => {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter((registration) =>
          [registration.active, registration.installing, registration.waiting].some(
            (worker) => worker?.scriptURL.endsWith("/mockServiceWorker.js"),
          ),
        )
        .map((registration) => registration.unregister()),
    );
  } catch {
    // A stale sample worker must never block the real API.
  }
};

const bootstrap = async () => {
  if (demoMode) {
    try {
      const { worker } = await import("./mocks/browser");
      await worker.start({
        onUnhandledRequest: "bypass",
        serviceWorker: { url: "/mockServiceWorker.js" },
      });
    } catch (error) {
      console.error("Sample API could not start", error);
    }
  } else {
    await stopSampleApi();
  }
  render();
  if (!import.meta.env.DEV) {
    startPwaRegistration();
  }
};

void bootstrap();
