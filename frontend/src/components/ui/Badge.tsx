import { ReactNode } from "react";
import { motion } from "framer-motion";
import { badgePop } from "../../lib/motionPresets";
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
    <motion.span
      data-variant={variant}
      className={["ui-badge", className].filter(Boolean).join(" ")}
      variants={badgePop}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.08, transition: { type: "spring", stiffness: 400, damping: 15 } }}
    >
      {children}
    </motion.span>
  );
}
