import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorBanner({ message, onRetry }) {
  if (!message) return null;

  return (
    <motion.div
      className="rounded-xl p-4 mb-6"
      style={{
        background: "rgba(255, 51, 102, 0.05)",
        border: "1px solid rgba(255, 51, 102, 0.2)",
      }}
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-neon-pink">
          <motion.div
            animate={{ rotate: [0, -10, 10, -5, 0] }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <AlertTriangle size={16} />
          </motion.div>
          <span className="text-sm font-medium">{message}</span>
        </div>
        {onRetry && (
          <motion.button
            onClick={onRetry}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-neon-cyan transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95, rotate: 180 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <RefreshCw size={12} />
            Retry
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}