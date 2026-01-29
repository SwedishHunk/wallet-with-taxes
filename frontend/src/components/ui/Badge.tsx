import { ReactNode } from "react";
import "./ui.css";

type Variant = "owner" | "studio" | "permission";

type BadgeProps = {
  variant?: Variant;
  children: ReactNode;
  className?: string;
};

export function Badge({
  variant = "permission",
  children,
  className,
}: BadgeProps) {
  return (
    <span
      data-variant={variant}
      className={["ui-badge", className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}
