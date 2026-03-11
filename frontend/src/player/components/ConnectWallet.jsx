import { motion } from "framer-motion";
import { useWallet } from "../context/WalletContext";
import { Wallet, LogOut, Shield } from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";

export default function ConnectWallet() {
  const { address, isConnected, isAdmin, connecting, connect, disconnect } =
    useWallet();
  const { t } = useLanguage();

  if (isConnected) {
    return (
      <motion.div
        className="flex items-center gap-3"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {isAdmin && (
          <motion.span
            className="badge bg-neon-purple/10 text-neon-purple border border-neon-purple/20"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25, delay: 0.1 }}
            whileHover={{ scale: 1.08 }}
          >
            <Shield size={12} className="mr-1" />
            Admin
          </motion.span>
        )}
        <motion.span
          className="font-mono text-xs text-gray-400 px-3 py-1.5 rounded-lg"
          style={{
            background: "rgba(15, 20, 40, 0.6)",
            border: "1px solid rgba(100, 120, 180, 0.15)",
          }}
          whileHover={{
            borderColor: "rgba(0, 212, 255, 0.3)",
            transition: { duration: 0.2 },
          }}
        >
          {address.slice(0, 6)}...{address.slice(-4)}
        </motion.span>
        <motion.button
          onClick={disconnect}
          title="Logout"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "34px", height: "34px", padding: 0,
            background: "transparent",
            border: "1px solid transparent",
            borderRadius: "12px",
            color: "rgba(255,255,255,0.38)",
            cursor: "pointer",
            flexShrink: 0,
            transition: "color 0.2s ease, border-color 0.2s ease, background 0.2s ease",
          }}
          whileHover={{
            color: "#ff3366",
            borderColor: "rgba(255,51,102,0.35)",
            backgroundColor: "rgba(255,51,102,0.08)",
          }}
          whileTap={{ scale: 0.93 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          <LogOut size={16} />
        </motion.button>
      </motion.div>
    );
  }

  return (
    <motion.button
      onClick={connect}
      disabled={connecting}
      className="btn-primary flex items-center gap-2"
      whileHover={connecting ? {} : { scale: 1.05, y: -2 }}
      whileTap={connecting ? {} : { scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Wallet size={16} />
      {connecting ? t("player.wallet.connecting") : t("player.wallet.connect")}
    </motion.button>
  );
}