import { ReactNode } from "react";
import "./ui.css";

type CardProps = {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function Card({ children, className, style }: CardProps) {
  return (
    <div
      className={["ui-card", className].filter(Boolean).join(" ")}
      style={style}>
      {children}
    </div>
  );
}
