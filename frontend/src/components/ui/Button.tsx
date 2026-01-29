import { ButtonHTMLAttributes, ReactNode } from "react";
import "./ui.css";

type Variant = "primary" | "secondary" | "danger";

type ButtonProps = {
  variant?: Variant;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  children,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      data-variant={variant}
      className={["ui-button", className].filter(Boolean).join(" ")}
      {...rest}>
      {children}
    </button>
  );
}
