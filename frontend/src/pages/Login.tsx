// src/pages/Login.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ROUTES } from "../routes";
import { login, getStudios } from "../lib/users";
import { setAuthToken } from "../lib/api";
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
      const { data } = await login(studioEmail, studioPassword);
      setAuthToken(data.token);
      localStorage.setItem("token", data.token);

      let studioId = data.user.studioId;
      let studioName = data.user.email;

      try {
        const studiosResponse = await getStudios();
        const studios: Array<{ id: string; name?: string }> =
          studiosResponse.data ?? [];
        const matched = studios.find((s) => s.id === studioId) ?? studios[0];
        if (matched) {
          studioId = matched.id || studioId;
          studioName = matched.name || studioName;
        }
      } catch (innerErr) {
        console.warn("Could not fetch studios list after login", innerErr);
      }

      const isTriolithAdmin = data.user.isAdmin === true;

      loginStudio({
        studioId,
        studioName,
        authenticatedAt: new Date().toISOString(),
        isTriolithAdmin,
      });

      navigate(isTriolithAdmin ? ROUTES.triolithAdmin : ROUTES.dashboard, {
        replace: true,
      });
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
