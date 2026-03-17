import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../lib/LanguageContext";
import { ROUTES } from "../routes";
import { signup } from "../lib/users";
import { setAuthToken } from "../lib/api";
import { useLoginStudio, useLoginMember } from "../lib/useAuth";
import "../style/Bright.css";
import "../style/Login.css";

function extractApiErrorMessage(err: unknown, fallback: string): string {
  const responseMessage = (
    err as { response?: { data?: { message?: string | string[] } } }
  )?.response?.data?.message;

  if (Array.isArray(responseMessage)) {
    return responseMessage.join(", ");
  }

  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }

  const networkMessage = (err as { message?: string })?.message;
  if (typeof networkMessage === "string" && networkMessage.trim()) {
    return networkMessage;
  }

  return fallback;
}

export default function CreateStudio() {
  const navigate = useNavigate();
  const { loginStudio } = useLoginStudio();
  const { loginMember } = useLoginMember();
  const { t } = useLanguage();

  const [studioName, setStudioName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!studioName.trim()) {
      setError(t("studio.errNameEmpty"));
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError(t("studio.errEmailInvalid"));
      return;
    }
    if (password.length < 6) {
      setError(t("studio.errPasswordShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("studio.errPasswordMismatch"));
      return;
    }

    setLoading(true);
    try {
      const { data } = await signup(email, password, studioName);

      // Save token
      setAuthToken(data.token);
      sessionStorage.setItem("token", data.token);

      // Set studio session
      loginStudio({
        studioId: data.studio.studioId,
        studioName: data.studio.studioName,
        authenticatedAt: new Date().toISOString(),
      });

      // Set member session (auto-activated as owner)
      loginMember({
        memberId: data.member.memberId,
        userId: data.member.userId,
        studioId: data.member.studioId,
        email: data.member.email,
        isOwner: data.member.isOwner,
        permissions: data.member.permissions,
        gameAccessIds: data.member.gameAccessIds,
        authenticatedAt: new Date().toISOString(),
      });

      // Navigate to dashboard
      navigate(ROUTES.dashboard, { replace: true });
    } catch (err: unknown) {
      setError(extractApiErrorMessage(err, t("studio.errFailed")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box" style={{ maxWidth: "500px" }}>
        <h1 className="login-title">{t("studio.create")}</h1>

        <form className="login-fields" onSubmit={handleSubmit}>
          {error && (
            <div className="bright-alert bright-alert-error">{error}</div>
          )}

          <input
            type="text"
            placeholder={t("studio.namePlaceholder")}
            className="login-input"
            value={studioName}
            onChange={(e) => setStudioName(e.target.value)}
            required
            autoFocus
          />

          <input
            type="email"
            placeholder={t("common.email")}
            className="login-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />

          <input
            type="password"
            placeholder={t("common.password")}
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <input
            type="password"
            placeholder={t("studio.confirmPassword")}
            className="login-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? t("studio.creating") : t("studio.create")}
          </button>
        </form>

        <p className="login-footer">
          {t("studio.hasAccount")}{" "}
          <span className="signup-link" onClick={() => navigate(ROUTES.login)}>
            {t("studio.loginLink")}
          </span>
        </p>
      </div>
    </div>
  );
}
