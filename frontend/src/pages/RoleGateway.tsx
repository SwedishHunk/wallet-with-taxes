import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { staggerContainer, fadeInUp, scalePop } from "../lib/motionPresets";
import { useLanguage } from "../lib/LanguageContext";
import { useAuthState } from "../lib/AuthContext";
import { devBootstrap } from "../lib/users";
import CyberpunkScene from "../components/3d/SafeCyberpunkScene";
import FilmGrainOverlay from "../components/3d/FilmGrainOverlay";
import "./RoleGateway.css";

export default function RoleGateway() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { setStudioSession, setMemberSession, setActiveGame } = useAuthState();
  const [bootstrapping, setBootstrapping] = useState<"player" | "studio" | "admin" | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const handleDevQuickstart = async (mode: "player" | "studio" | "admin") => {
    try {
      setBootstrapping(mode);
      setBootstrapError(null);

      const { data } = await devBootstrap({ mode });
      // Cookie is set server-side by the bootstrap endpoint.
      setStudioSession(data.studio);
      setMemberSession(data.member);
      setActiveGame(data.game);
      navigate(
        data.recommendedLanding ||
          (mode === "studio"
            ? data.routes.dashboard
            : mode === "admin"
              ? data.routes.admin
              : data.routes.trade),
      );
    } catch (error: unknown) {
      const e = error as { response?: { data?: { message?: string } }; message?: string };
      setBootstrapError(
        e?.response?.data?.message ||
          e?.message ||
          "Dev bootstrap failed",
      );
    } finally {
      setBootstrapping(null);
    }
  };

  return (
    <div className="role-gateway">
      <CyberpunkScene intensity="full" sacredGeometry="flower" />
      <FilmGrainOverlay />
      <div className="role-gateway__backdrop" />

      <motion.div
        className="role-gateway__panel"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        <motion.div className="role-gateway__eyebrow" variants={fadeInUp}>
          {t("role.eyebrow")}
        </motion.div>

        <motion.h1
          className="role-gateway__title"
          variants={fadeInUp}
        >
          {t("role.title")}
        </motion.h1>

        <motion.p className="role-gateway__intro" variants={fadeInUp}>
          {t("role.intro")}
        </motion.p>

        <motion.div className="role-gateway__choices" variants={staggerContainer}>
          <motion.div variants={scalePop}>
            <Link className="role-card role-card--player" to="/player">
              <motion.span
                className="role-card__label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {t("role.player")}
              </motion.span>
              <span className="role-card__headline">{t("role.player.headline")}</span>
              <span className="role-card__body">
                {t("role.player.body")}
              </span>
            </Link>
          </motion.div>

          <motion.div variants={scalePop}>
            <Link className="role-card role-card--owner" to="/login">
              <motion.span
                className="role-card__label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                {t("role.owner")}
              </motion.span>
              <span className="role-card__headline">
                {t("role.owner.headline")}
              </span>
              <span className="role-card__body">
                {t("role.owner.body")}
              </span>
            </Link>
          </motion.div>
        </motion.div>

        {import.meta.env.DEV && (
          <motion.div
            variants={fadeInUp}
            style={{
              marginTop: "1.5rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "0.75rem",
              }}
            >
              <button
                type="button"
                onClick={() => handleDevQuickstart("player")}
                disabled={bootstrapping !== null}
                style={{
                  border: "1px solid rgba(0, 212, 255, 0.35)",
                  background: "rgba(6, 14, 32, 0.8)",
                  color: "#8be9fd",
                  padding: "0.9rem 1.2rem",
                  borderRadius: "999px",
                  cursor: bootstrapping ? "wait" : "pointer",
                  fontWeight: 700,
                }}
              >
                {bootstrapping === "player"
                  ? "Bootstrapping player demo..."
                  : "Dev Quickstart: Player"}
              </button>
              <button
                type="button"
                onClick={() => handleDevQuickstart("studio")}
                disabled={bootstrapping !== null}
                style={{
                  border: "1px solid rgba(129, 140, 248, 0.35)",
                  background: "rgba(13, 19, 40, 0.88)",
                  color: "#c7d2fe",
                  padding: "0.9rem 1.2rem",
                  borderRadius: "999px",
                  cursor: bootstrapping ? "wait" : "pointer",
                  fontWeight: 700,
                }}
              >
                {bootstrapping === "studio"
                  ? "Bootstrapping studio demo..."
                  : "Dev Quickstart: Studio"}
              </button>
              <button
                type="button"
                onClick={() => handleDevQuickstart("admin")}
                disabled={bootstrapping !== null}
                style={{
                  border: "1px solid rgba(255, 184, 107, 0.35)",
                  background: "rgba(36, 20, 6, 0.88)",
                  color: "#ffd29d",
                  padding: "0.9rem 1.2rem",
                  borderRadius: "999px",
                  cursor: bootstrapping ? "wait" : "pointer",
                  fontWeight: 700,
                }}
              >
                {bootstrapping === "admin"
                  ? "Bootstrapping admin demo..."
                  : "Dev Quickstart: Admin"}
              </button>
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.68)",
                fontSize: "0.95rem",
                textAlign: "center",
                maxWidth: "42rem",
              }}
            >
              Player quickstart opens game-scoped trade directly. Studio quickstart opens the
              studio dashboard. Admin quickstart opens the Triolith admin view with a demo admin
              session ready.
            </div>
            {bootstrapError && (
              <div
                style={{
                  color: "#ff7aa2",
                  fontSize: "0.95rem",
                  textAlign: "center",
                  maxWidth: "42rem",
                }}
              >
                {bootstrapError}
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
