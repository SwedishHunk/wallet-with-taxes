import { motion } from "framer-motion";

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 25 },
  },
};

export default function StatCard({
  label,
  value,
  sub,
  meta,
  color = "cyan",
  icon: Icon,
}) {
  const glowClass = {
    cyan: "glow-text-cyan",
    green: "glow-text-green",
    pink: "glow-text-pink",
    purple: "glow-text-purple",
  }[color] || "glow-text-cyan";

  const hoverShadow = {
    cyan: "0 0 25px rgba(0, 212, 255, 0.12), 0 8px 32px rgba(0, 0, 0, 0.3)",
    green: "0 0 25px rgba(0, 255, 136, 0.12), 0 8px 32px rgba(0, 0, 0, 0.3)",
    pink: "0 0 25px rgba(255, 51, 102, 0.12), 0 8px 32px rgba(0, 0, 0, 0.3)",
    purple: "0 0 25px rgba(168, 85, 247, 0.12), 0 8px 32px rgba(0, 0, 0, 0.3)",
  }[color] || "0 0 25px rgba(0, 212, 255, 0.12), 0 8px 32px rgba(0, 0, 0, 0.3)";

  const hoverBorder = {
    cyan: "rgba(0, 212, 255, 0.25)",
    green: "rgba(0, 255, 136, 0.25)",
    pink: "rgba(255, 51, 102, 0.25)",
    purple: "rgba(168, 85, 247, 0.25)",
  }[color] || "rgba(0, 212, 255, 0.25)";

  return (
    <motion.div
      className="card"
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{
        y: -4,
        boxShadow: hoverShadow,
        borderColor: hoverBorder,
        transition: { type: "spring", stiffness: 400, damping: 20 },
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="label">{label}</p>
          <motion.p
            className={`text-2xl font-bold font-mono mt-1 ${glowClass}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.06 }}
          >
            {value}
          </motion.p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
          {meta && <p className="text-xs text-gray-400 mt-1" style={{ fontSize: "12px" }}>{meta}</p>}
        </div>
        {Icon && (
          <motion.div
            className="p-2 rounded-lg"
            style={{ background: "rgba(15, 20, 40, 0.6)" }}
            whileHover={{ rotate: 8, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <Icon size={20} className="text-gray-500" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
