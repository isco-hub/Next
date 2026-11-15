import { lazy, Suspense } from "react";
import { useI18n } from "@nextcrop/i18n";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LoadingPanel } from "./components/PageState";
import { RequireAuth, RequireRole } from "./components/RouteGuards";

const LandingPage = lazy(() =>
  import("./pages/LandingPage").then((module) => ({ default: module.LandingPage })),
);
const LocationPage = lazy(() =>
  import("./pages/LocationPage").then((module) => ({ default: module.LocationPage })),
);
const ClimatePage = lazy(() =>
  import("./pages/ClimatePage").then((module) => ({ default: module.ClimatePage })),
);
const WizardPage = lazy(() =>
  import("./pages/WizardPage").then((module) => ({ default: module.WizardPage })),
);
const PlanPage = lazy(() =>
  import("./pages/PlanPage").then((module) => ({ default: module.PlanPage })),
);
const PlotsPage = lazy(() =>
  import("./pages/PlotsPage").then((module) => ({ default: module.PlotsPage })),
);
const FeedbackPage = lazy(() =>
  import("./pages/FeedbackPage").then((module) => ({ default: module.FeedbackPage })),
);
const SignInPage = lazy(() =>
  import("./pages/SignInPage").then((module) => ({ default: module.SignInPage })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);
const OfficerPage = lazy(() =>
  import("./pages/OfficerPage").then((module) => ({ default: module.OfficerPage })),
);
const ExtensionDashboardPage = lazy(() =>
  import("./pages/ExtensionDashboardPage").then((module) => ({
    default: module.ExtensionDashboardPage,
  })),
);
const FarmerDashboardPage = lazy(() =>
  import("./pages/FarmerDashboardPage").then((module) => ({
    default: module.FarmerDashboardPage,
  })),
);
const CooperativeDashboardPage = lazy(() =>
  import("./pages/CooperativeDashboardPage").then((module) => ({
    default: module.CooperativeDashboardPage,
  })),
);
const AgronomistDashboardPage = lazy(() =>
  import("./pages/AgronomistDashboardPage").then((module) => ({
    default: module.AgronomistDashboardPage,
  })),
);
const AdminDashboardPage = lazy(() =>
  import("./pages/AdminDashboardPage").then((module) => ({
    default: module.AdminDashboardPage,
  })),
);
const DashboardRedirect = lazy(() =>
  import("./pages/DashboardRedirect").then((module) => ({
    default: module.DashboardRedirect,
  })),
);
const ReportsPage = lazy(() =>
  import("./pages/ReportsPage").then((module) => ({ default: module.ReportsPage })),
);
const AdminPacksPage = lazy(() =>
  import("./pages/AdminPacksPage").then((module) => ({ default: module.AdminPacksPage })),
);
const AdminPackEditorPage = lazy(() =>
  import("./pages/AdminPackEditorPage").then((module) => ({
    default: module.AdminPackEditorPage,
  })),
);
const AdminAuditPage = lazy(() =>
  import("./pages/AdminAuditPage").then((module) => ({ default: module.AdminAuditPage })),
);
const AdminOfficerApprovalsPage = lazy(() =>
  import("./pages/AdminOfficerApprovalsPage").then((module) => ({
    default: module.AdminOfficerApprovalsPage,
  })),
);
const TranslationPage = lazy(() =>
  import("./pages/TranslationPage").then((module) => ({ default: module.TranslationPage })),
);
const UssdPage = lazy(() =>
  import("./pages/UssdPage").then((module) => ({ default: module.UssdPage })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })),
);

const RouteFallback = () => {
  const { t } = useI18n();
  return (
    <div className="page container">
      <LoadingPanel label={t("common.loading")} />
    </div>
  );
};

const ADMIN_ROLES = ["agronomist", "admin"] as const;

export const App = () => (
  <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<LandingPage />} />
        <Route path="location" element={<LocationPage />} />
        <Route path="climate" element={<ClimatePage />} />
        <Route path="wizard" element={<WizardPage />} />
        <Route path="plan" element={<PlanPage />} />
        <Route
          path="plots"
          element={
            <RequireAuth>
              <PlotsPage />
            </RequireAuth>
          }
        />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="sign-in" element={<SignInPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="dashboard" element={<DashboardRedirect />} />
        <Route
          path="farmer"
          element={
            <RequireRole roles={["farmer", "admin"]}>
              <FarmerDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="cooperative"
          element={
            <RequireRole roles={["cooperative", "admin"]}>
              <CooperativeDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="agronomist"
          element={
            <RequireRole roles={["agronomist", "admin"]}>
              <AgronomistDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="extension"
          element={
            <RequireRole roles={["extension_officer", "admin"]}>
              <ExtensionDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="extension/dashboard"
          element={
            <RequireRole roles={["extension_officer", "admin"]}>
              <ExtensionDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="officer"
          element={
            <RequireRole
              roles={["extension_officer", "cooperative", "agronomist", "admin"]}
            >
              <OfficerPage />
            </RequireRole>
          }
        />
        <Route
          path="reports"
          element={
            <RequireRole roles={["extension_officer", "cooperative", "agronomist", "admin"]}>
              <ReportsPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/dashboard"
          element={
            <RequireRole roles={["admin"]}>
              <AdminDashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="admin"
          element={
            <RequireRole roles={[...ADMIN_ROLES]}>
              <AdminPacksPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/rulepacks"
          element={
            <RequireRole roles={[...ADMIN_ROLES]}>
              <AdminPacksPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/rulepacks/:id"
          element={
            <RequireRole roles={[...ADMIN_ROLES]}>
              <AdminPackEditorPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/audit"
          element={
            <RequireRole roles={[...ADMIN_ROLES]}>
              <AdminAuditPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/officers"
          element={
            <RequireRole roles={["admin"]}>
              <AdminOfficerApprovalsPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/translations"
          element={
            <RequireRole roles={[...ADMIN_ROLES]}>
              <TranslationPage />
            </RequireRole>
          }
        />
        <Route path="ussd" element={<UssdPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  </Suspense>
);

