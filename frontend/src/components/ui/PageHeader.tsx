import { ReactNode } from "react";
import "./ui.css";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={["ui-page-header", className].filter(Boolean).join(" ")}>
      <div className="ui-page-header-content">
        <div>
          <h1 className="ui-page-header-title">{title}</h1>
          {subtitle && <p className="ui-page-header-subtitle">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="ui-page-header-actions">{children}</div>}
    </div>
  );
}
