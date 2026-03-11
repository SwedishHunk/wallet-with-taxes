import { ReactNode } from "react";
import { motion } from "framer-motion";
import { pageVariants } from "../../lib/motionPresets";
import "./ui.css";

type PageProps = {
  children: ReactNode;
  className?: string;
};

export function Page({ children, className }: PageProps) {
  return (
    <motion.div
      className={["ui-page", className].filter(Boolean).join(" ")}
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}
