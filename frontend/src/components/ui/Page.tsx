import { ReactNode } from "react";
import "./ui.css";

type PageProps = {
  children: ReactNode;
  className?: string;
};

export function Page({ children, className }: PageProps) {
  return (
    <div className={["ui-page", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
