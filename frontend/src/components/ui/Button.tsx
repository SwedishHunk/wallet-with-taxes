import { ButtonHTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
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
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      data-variant={variant}
      className={["ui-button", className].filter(Boolean).join(" ")}
      whileHover={disabled ? {} : { scale: 1.03, y: -2 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      disabled={disabled}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
