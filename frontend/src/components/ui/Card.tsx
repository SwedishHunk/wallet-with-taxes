import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cardVariants } from "../../lib/motionPresets";
import "./ui.css";

type CardProps = {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function Card({ children, className, style }: CardProps) {
  return (
    <motion.div
      className={["ui-card", className].filter(Boolean).join(" ")}
      style={style}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{
        borderColor: "rgba(0, 212, 255, 0.25)",
        boxShadow:
          "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 30px rgba(0, 212, 255, 0.06)",
        y: -3,
        transition: { type: "spring", stiffness: 400, damping: 25 },
      }}
    >
      {children}
    </motion.div>
  );
}
