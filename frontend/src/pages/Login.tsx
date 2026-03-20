// src/pages/Login.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ROUTES } from "../routes";
import { login, selectStudio } from "../lib/users";
import { useAuthState } from "../lib/AuthContext";
import { useLoginStudio } from "../lib/useAuth";
import { useLanguage } from "../lib/LanguageContext";
import CyberpunkScene from "../components/3d/SafeCyberpunkScene";
import FilmGrainOverlay from "../components/3d/FilmGrainOverlay";
import "../style/Login.css";
import "../style/Bright.css";

type ApiError = { response?: { data?: { message?: string } } };

export default function Login() {
  const navigate = useNavigate();
  const { authContext } = useAuthState();
  const { loginStudio } = useLoginStudio();
  const { t } = useLanguage();

  const [studioEmail, setStudioEmail] = useState("");
  const [studioPassword, setStudioPassword] = useState("");
  const [studioError, setStudioError] = useState<string | null>(null);
  const [studioLoading, setStudioLoading] = useState(false);

  useEffect(() => {
    if (authContext.studioSession?.isTriolithAdmin === true) {
      navigate(ROUTES.triolithAdmin, { replace: true });
      return;
    }
    if (authContext.state === "Studio+MemberActive") {
      navigate(ROUTES.dashboard, { replace: true });
    }
  }, [authContext.state, authContext.studioSession, navigate]);

  const handleStudioLogin = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setStudioLoading(true);

    try {
      // Cookie is set server-side — no token to store client-side.
      const { data } = await login(studioEmail, studioPassword);

      const studios: Array<{ id: string; name: string; role: string }> =
        data.studios ?? [];
      const isTriolithAdmin = data.user?.isAdmin === true;

      if (studios.length === 0) {
        setStudioError("No active studios found. Please contact support.");
        return;
      }

      if (studios.length === 1) {
        // Auto-select the only studio — no picker needed.
        const { data: studioData } = await selectStudio(studios[0].id);
        loginStudio({
          studioId: studioData.studioId,
          studioName: studioData.studioName,
          authenticatedAt: new Date().toISOString(),
          isTriolithAdmin: studioData.isTriolithAdmin ?? isTriolithAdmin,
        });
        navigate(
          studioData.isTriolithAdmin ? ROUTES.triolithAdmin : ROUTES.dashboard,
          { replace: true },
        );
      } else {
        // Multiple studios — show the picker so the user explicitly chooses.
        navigate(ROUTES.studios, { replace: true });
      }
    } catch (err) {
      const error = err as ApiError;
      const message =
        error.response?.data?.message || "Login failed. Please try again.";
      setStudioError(message);
    } finally {
      setStudioLoading(false);
    }
  };

  const showStudioForm = authContext.state === "Unauthenticated";

  return (
    <div className="login-page">
      <CyberpunkScene intensity="full" />
      <FilmGrainOverlay />
      <div className="login-grid">
        <motion.div
          className="login-box"
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        >
          <motion.h1
            className="login-title"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {t("login.title")}
          </motion.h1>

          {studioError && (
            <motion.div
              className="bright-alert bright-alert-error"
              aria-live="polite"
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div>{studioError}</div>
              <button
                type="button"
                className="login-alert-close"
                onClick={() => setStudioError(null)}
              >
                {t("login.close")}
              </button>
            </motion.div>
          )}

          {showStudioForm ? (
            <motion.form
              className="login-fields"
              onSubmit={handleStudioLogin}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              <motion.input
                type="email"
                placeholder={t("common.email")}
                className="login-input"
                value={studioEmail}
                onChange={(e) => setStudioEmail(e.target.value)}
                autoComplete="username"
                required
                whileFocus={{
                  borderColor: "#00d4ff",
                  boxShadow:
                    "0 0 0 3px rgba(0, 212, 255, 0.15), 0 0 20px rgba(0, 212, 255, 0.08)",
                }}
              />
              <motion.input
                type="password"
                placeholder={t("common.password")}
                className="login-input"
                value={studioPassword}
                onChange={(e) => setStudioPassword(e.target.value)}
                autoComplete="current-password"
                required
                whileFocus={{
                  borderColor: "#00d4ff",
                  boxShadow:
                    "0 0 0 3px rgba(0, 212, 255, 0.15), 0 0 20px rgba(0, 212, 255, 0.08)",
                }}
              />
              <motion.button
                type="submit"
                className="login-button"
                disabled={studioLoading}
                whileHover={studioLoading ? {} : { scale: 1.02, y: -2 }}
                whileTap={studioLoading ? {} : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                {studioLoading ? t("login.loggingIn") : t("login.submit")}
              </motion.button>
            </motion.form>
          ) : (
            <motion.div
              className="login-note"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {t("login.studioActive")}
              <motion.button
                type="button"
                className="login-button"
                style={{ marginTop: "12px" }}
                onClick={() => navigate(ROUTES.memberLogin)}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                {t("member.loginBtn")}
              </motion.button>
            </motion.div>
          )}

          {showStudioForm && (
            <motion.p
              className="login-footer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              {t("login.noAccount")}{" "}
              <span
                className="signup-link"
                onClick={() => navigate(ROUTES.createStudio)}
              >
                {t("login.createStudio")}
              </span>
            </motion.p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
