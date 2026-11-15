import type { ReactElement } from "react";
import type { Role } from "@nextcrop/api-client";
import { useI18n } from "@nextcrop/i18n";
import { Button, EmptyState } from "@nextcrop/ui";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export const RequireAuth = ({ children }: { children: ReactElement }) => {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  return children;
};

export const RequireRole = ({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactElement;
}) => {
  const { user, can } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (!can(...roles)) {
    return (
      <div className="page container">
        <EmptyState
          icon="lock"
          title={t("auth.notAuthorizedTitle")}
          body={t("auth.notAuthorizedBody")}
          action={
            <Button onClick={() => navigate("/sign-in")}>
              {t("nav.signIn")}
            </Button>
          }
        />
      </div>
    );
  }

  return children;
};
