import { useEffect, useState } from "react";
import { useI18n } from "@nextcrop/i18n";
import {
  Badge,
  Button,
  Icon,
  OfflineBanner,
  Sheet,
  type IconName,
} from "@nextcrop/ui";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { demoMode } from "../lib/api";
import { listQueuedFeedback, listQueuedRecommendations } from "../lib/cache";
import { useOnline } from "../lib/online";
import { useOfflineQueue } from "../lib/queue";
import { InstallPrompt } from "./InstallPrompt";
import { ScrollToTop } from "./ScrollToTop";
import { UpdatePrompt } from "./UpdatePrompt";

interface ShellLink {
  to: string;
  label: string;
  icon: IconName;
}

export const AppShell = () => {
  const { t } = useI18n();
  const { user, can, signOut } = useAuth();
  const online = useOnline();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [, refreshQueueCount] = useState(0);
  useOfflineQueue();

  useEffect(() => {
    const timer = window.setInterval(
      () => refreshQueueCount((value) => value + 1),
      5_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  const pendingCount =
    listQueuedRecommendations().length + listQueuedFeedback().length;

  const role = user?.role;
  const publicLinks: ShellLink[] = [
    { to: "/", label: t("nav.home"), icon: "sprout" },
    { to: "/wizard", label: t("nav.newPlan"), icon: "sparkle" },
    { to: "/plots", label: t("nav.myPlots"), icon: "map" },
    { to: "/climate", label: t("nav.climate"), icon: "rain" },
  ];
  const farmerLinks: ShellLink[] = [
    { to: "/", label: t("nav.home"), icon: "sprout" },
    { to: "/farmer", label: t("nav.dashboard"), icon: "chart" },
    { to: "/wizard", label: t("nav.newPlan"), icon: "sparkle" },
    { to: "/plots", label: t("nav.myPlots"), icon: "map" },
    { to: "/climate", label: t("nav.climate"), icon: "rain" },
  ];
  const extensionLinks: ShellLink[] = [
    { to: "/", label: t("nav.home"), icon: "sprout" },
    { to: "/extension", label: t("nav.extensionSite"), icon: "chart" },
    { to: "/officer", label: t("nav.fieldWork"), icon: "users" },
    { to: "/reports", label: t("nav.reports"), icon: "file" },
    { to: "/climate", label: t("nav.climate"), icon: "rain" },
  ];
  const adminLinks: ShellLink[] = [
    { to: "/", label: t("nav.home"), icon: "sprout" },
    { to: "/admin/dashboard", label: t("nav.adminDashboard"), icon: "shield" },
    { to: "/admin/rulepacks", label: t("nav.rulePacks"), icon: "file" },
    { to: "/admin/officers", label: t("nav.officerApprovals"), icon: "users" },
    { to: "/reports", label: t("nav.reports"), icon: "chart" },
    { to: "/admin/audit", label: t("nav.audit"), icon: "users" },
  ];
  const primaryLinks =
    role === "farmer"
      ? farmerLinks
      : role === "extension_officer"
        ? extensionLinks
        : role === "admin"
          ? adminLinks
          : publicLinks;

  const staffLinks: ShellLink[] = [];
  if (role === "admin") {
    staffLinks.push({ to: "/admin/translations", label: t("nav.translations"), icon: "file" });
    staffLinks.push({ to: "/farmer", label: t("nav.farmerWorkspace"), icon: "sprout" });
    staffLinks.push({ to: "/extension", label: t("nav.extensionWorkspace"), icon: "users" });
  } else if (can("cooperative", "agronomist")) {
    staffLinks.push({ to: "/officer", label: t("nav.officer"), icon: "users" });
    staffLinks.push({ to: "/reports", label: t("nav.reports"), icon: "chart" });
    staffLinks.push({ to: "/admin/rulepacks", label: t("nav.rulePacks"), icon: "shield" });
    staffLinks.push({ to: "/admin/audit", label: t("nav.audit"), icon: "file" });
  }
  const moreLinks: ShellLink[] = [
    ...staffLinks,
    { to: "/ussd", label: t("nav.ussd"), icon: "phone" },
    { to: "/settings", label: t("nav.settings"), icon: "user" },
  ];


  const close = () => setMenuOpen(false);

  return (
    <div className="appShell">
      <a className="skipLink" href="#main">
        {t("common.skipToContent")}
      </a>
      <ScrollToTop />
      <header className="appHeader">
        <div className="container appHeaderInner">
          <Link to="/" className="brand" aria-label={t("common.appName")}>
            <span className="brandMark" aria-hidden="true">
              <Icon name="sprout" size={24} />
            </span>
            <span className="brandText">
              <strong>{t("common.appName")}</strong>
              <span className="brandTagline">{t("common.tagline")}</span>
            </span>
          </Link>

          <nav className="desktopNav" aria-label={t("common.mainNav")}>
            {primaryLinks.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.to === "/"}>
                {link.label}
              </NavLink>
            ))}
            {staffLinks.map((link) => (
              <NavLink key={link.to} to={link.to}>
                {link.label}
              </NavLink>
            ))}
            <NavLink to="/ussd">{t("nav.ussd")}</NavLink>
          </nav>

          <div className="headerActions">
            <Link
              to={user ? "/settings" : "/sign-in"}
              className="iconLink"
              aria-label={t("nav.account")}
            >
              <Icon name="user" size={20} />
            </Link>
          </div>
        </div>
      </header>

      <OfflineBanner offline={!online} pendingCount={pendingCount} />

      <main id="main" className="appMain">
        <Outlet />
      </main>

      <footer className="appFooter">
        <div className="container appFooterInner">
          <div>
            <p className="footerBrand">{t("common.appName")}</p>
            <p className="footerNote">{t("common.nasaAttribution")}</p>
          </div>
          <nav className="footerLinks" aria-label={t("common.footerLinks")}>
            <Link to="/settings">{t("common.privacy")}</Link>
            <Link to="/settings">{t("common.accessibility")}</Link>
            <Link to="/settings">{t("common.contact")}</Link>
            <Link to="/ussd">{t("nav.ussd")}</Link>
          </nav>
          {demoMode ? <Badge tone="warn">{t("common.sampleData")}</Badge> : null}
        </div>
      </footer>

      <nav className="bottomNav" aria-label={t("common.mainNav")}>
        {primaryLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className="bottomNavItem"
          >
            <Icon name={link.icon} size={20} />
            <span>{link.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className="bottomNavItem"
          onClick={() => setMenuOpen(true)}
          aria-haspopup="dialog"
        >
          <Icon name="menu" size={20} />
          <span>{t("nav.menu")}</span>
        </button>
      </nav>

      <Sheet
        open={menuOpen}
        onClose={close}
        title={t("nav.menu")}
        closeLabel={t("common.closeDialog")}
        footer={
          user ? (
            <div className="stack">
              <p className="muted">
                {t("auth.signedInAs", {
                  name: user.display_name ?? t("common.appName"),
                })}
              </p>
              <Button
                variant="secondary"
                fullWidth
                icon={<Icon name="logout" size={18} />}
                onClick={() => {
                  void signOut().then(() => {
                    close();
                    navigate("/");
                  });
                }}
              >
                {t("nav.signOut")}
              </Button>
            </div>
          ) : (
            <Button
              fullWidth
              icon={<Icon name="user" size={18} />}
              onClick={() => {
                close();
                navigate("/sign-in");
              }}
            >
              {t("nav.signIn")}
            </Button>
          )
        }
      >
        <nav className="menuList" aria-label={t("common.mainNav")}>
          {[...primaryLinks, ...moreLinks].map((link) => (
            <Link key={link.to} to={link.to} className="menuLink" onClick={close}>
              <Icon name={link.icon} size={20} />
              <span>{link.label}</span>
              <Icon name="chevron-right" size={18} />
            </Link>
          ))}
        </nav>
      </Sheet>

      <InstallPrompt />
      <UpdatePrompt />
    </div>
  );
};

