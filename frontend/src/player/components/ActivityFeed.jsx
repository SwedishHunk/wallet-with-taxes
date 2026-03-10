import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { ethers } from "ethers";

function formatAmount(raw, decimals = 18) {
  try {
    return Number(ethers.formatUnits(raw, decimals)).toFixed(4);
  } catch {
    return raw;
  }
}

function shortenAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 300, damping: 28 },
  },
};

export default function ActivityFeed({ events = [], loading }) {
  if (loading) {
    return (
      <div className="card">
        <p className="label mb-4">Recent Activity</p>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="h-12 rounded-lg"
              style={{ background: "rgba(15, 20, 40, 0.6)" }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="label mb-4">Recent Activity</p>
      {events.length === 0 ? (
        <motion.p
          className="text-gray-500 text-sm text-center py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          No activity yet
        </motion.p>
      ) : (
        <motion.div
          className="space-y-2"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {events.map((e, i) => {
            const isBuy = e.type === "BUY";
            const assetDecimals = e.assetSymbol === "ETH" ? 18 : 6;

            return (
              <motion.div
                key={`${e.txHash}-${i}`}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors"
                style={{ background: "rgba(15, 20, 40, 0.4)" }}
                variants={rowVariants}
                whileHover={{
                  backgroundColor: "rgba(15, 20, 40, 0.7)",
                  x: 4,
                  transition: { type: "spring", stiffness: 400, damping: 25 },
                }}
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    className={`p-1.5 rounded-lg ${
                      isBuy ? "bg-neon-green/10" : "bg-neon-pink/10"
                    }`}
                    whileHover={{ scale: 1.15, rotate: isBuy ? -8 : 8 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  >
                    {isBuy ? (
                      <ArrowDownLeft size={14} className="text-neon-green" />
                    ) : (
                      <ArrowUpRight size={14} className="text-neon-pink" />
                    )}
                  </motion.div>
                  <div>
                    <span className={isBuy ? "badge-buy" : "badge-sell"}>
                      {e.type}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {shortenAddr(e.user)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  {isBuy ? (
                    <p className="text-sm font-mono">
                      <span className="text-gray-400">
                        {formatAmount(e.amountIn, assetDecimals)} {e.assetSymbol}
                      </span>
                      <span className="text-gray-600 mx-1.5">→</span>
                      <span className="text-neon-green">
                        {formatAmount(e.amountOut, 18)} TRI
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm font-mono">
                      <span className="text-gray-400">
                        {formatAmount(e.amountIn, 18)} TRI
                      </span>
                      <span className="text-gray-600 mx-1.5">→</span>
                      <span className="text-neon-pink">
                        {formatAmount(e.amountOut, assetDecimals)} {e.assetSymbol}
                      </span>
                    </p>
                  )}
                  <p className="text-xs text-gray-600 mt-0.5">
                    Block {e.block} · {timeAgo(e.timestamp)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}