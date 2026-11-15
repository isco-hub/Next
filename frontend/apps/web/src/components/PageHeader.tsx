import type { ReactNode } from "react";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export const PageHeader = ({ eyebrow, title, subtitle, actions }: PageHeaderProps) => (
  <header className="pageHeader">
    <div>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {subtitle ? <p className="lede">{subtitle}</p> : null}
    </div>
    {actions ? <div className="pageHeaderActions">{actions}</div> : null}
  </header>
);

