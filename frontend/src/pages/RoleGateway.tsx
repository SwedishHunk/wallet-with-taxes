import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { staggerContainer, fadeInUp, scalePop } from "../lib/motionPresets";
import { useLanguage } from "../lib/LanguageContext";
import { setAuthToken } from "../lib/api";
import { useAuthState } from "../lib/AuthContext";
import { devBootstrap } from "../lib/users";
import CyberpunkScene from "../components/3d/SafeCyberpunkScene";
import FilmGrainOverlay from "../components/3d/FilmGrainOverlay";
import "./RoleGateway.css";

export default function RoleGateway() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { setStudioSession, setMemberSession, setActiveGame } = useAuthState();
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const handleDevQuickstart = async () => {
    try {
      setBootstrapping(true);
      setBootstrapError(null);

      const { data } = await devBootstrap();
      sessionStorage.setItem("token", data.token);
      setAuthToken(data.token);
      setStudioSession(data.studio);
      setMemberSession(data.member);
      setActiveGame(data.game);
      navigate(data.routes.trade);
    } catch (error: unknown) {
      const e = error as { response?: { data?: { message?: string } }; message?: string };
      setBootstrapError(
        e?.response?.data?.message ||
          e?.message ||
          "Dev bootstrap failed",
      );
    } finally {
      setBootstrapping(false);
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

        <motion.div className="role-gateway__intro" variants={fadeInUp}>
          <p>{t("role.intro.player")}</p>
          <p>{t("role.intro.owner")}</p>
        </motion.div>

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
            <button
              type="button"
              onClick={handleDevQuickstart}
              disabled={bootstrapping}
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
              {bootstrapping ? "Bootstrapping dev session..." : "Dev Quickstart"}
            </button>
            <div
              style={{
                color: "rgba(255,255,255,0.68)",
                fontSize: "0.95rem",
                textAlign: "center",
                maxWidth: "42rem",
              }}
            >
              Creates or reuses a dev studio, owner account, member session, test game,
              sets active game, and opens game-scoped trade directly.
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
