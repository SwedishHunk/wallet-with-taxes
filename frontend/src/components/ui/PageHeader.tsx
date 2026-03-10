import { ReactNode } from "react";
import { motion } from "framer-motion";
import { fadeInUp, slideInRight } from "../../lib/motionPresets";
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
    <motion.div
      className={["ui-page-header", className].filter(Boolean).join(" ")}
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
    >
      <div className="ui-page-header-content">
        <div>
          <motion.h1
            className="ui-page-header-title"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
          >
            {title}
          </motion.h1>
          {subtitle && (
            <motion.p
              className="ui-page-header-subtitle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.4 }}
            >
              {subtitle}
            </motion.p>
          )}
        </div>
      </div>
      {children && (
        <motion.div
          className="ui-page-header-actions"
          variants={slideInRight}
          initial="hidden"
          animate="visible"
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  );
}
