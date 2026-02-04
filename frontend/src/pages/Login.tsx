// src/pages/Login.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../routes";
import { login, getStudios, getMemberSession } from "../lib/users";
import { setAuthToken } from "../lib/api";
import { useAuthState } from "../lib/AuthContext";
import { useLoginMember, useLoginStudio } from "../lib/useAuth";
import "../style/Login.css";
import "../style/Bright.css";

type ApiError = { response?: { data?: { message?: string } } };

export default function Login() {
  const navigate = useNavigate();
  const { authContext } = useAuthState();
  const { loginStudio } = useLoginStudio();
  const { loginMember } = useLoginMember();

  const [studioEmail, setStudioEmail] = useState("");
  const [studioPassword, setStudioPassword] = useState("");
  const [studioError, setStudioError] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);

  // Keep errors until next interaction; no auto-clear so user can read them

  // Redirect if already fully authenticated
  useEffect(() => {
    if (authContext.state === "Studio+MemberActive") {
      navigate(ROUTES.dashboard, { replace: true });
    }
  }, [authContext.state, navigate]);

  const handleStudioLogin = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setStudioLoading(true);

    try {
      const { data } = await login(studioEmail, studioPassword);
      setAuthToken(data.token);
      localStorage.setItem("token", data.token);

      // Fetch studios to resolve name + confirmed studioId
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

      loginStudio({
        studioId,
        studioName,
        authenticatedAt: new Date().toISOString(),
      });

      navigate(ROUTES.dashboard, { replace: true });
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
      <div className="login-grid">
        <div className="login-box">
          <h1 className="login-title">Studio login</h1>
          {studioError && (
            <div className="bright-alert bright-alert-error" aria-live="polite">
              <div>{studioError}</div>
              <button
                type="button"
                className="login-alert-close"
                onClick={() => setStudioError(null)}>
                Stäng
              </button>
            </div>
          )}
          {showStudioForm ? (
            <form className="login-fields" onSubmit={handleStudioLogin}>
              <input
                type="email"
                placeholder="Email"
                className="login-input"
                value={studioEmail}
                onChange={(e) => setStudioEmail(e.target.value)}
                autoComplete="username"
                required
              />
              <input
                type="password"
                placeholder="Password"
                className="login-input"
                value={studioPassword}
                onChange={(e) => setStudioPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="submit"
                className="login-button"
                disabled={studioLoading}>
                {studioLoading ? "Signing in..." : "Sign in to studio"}
              </button>
            </form>
          ) : (
            <div className="login-note">
              Studio-session redan aktiv. Fortsätt till member-login.
              <button
                type="button"
                className="login-button"
                style={{ marginTop: "12px" }}
                onClick={() => navigate(ROUTES.memberLogin)}>
                Logga in som medlem
              </button>
            </div>
          )}
          {showStudioForm && (
            <p className="login-footer">
              Har du ingen studio?{" "}
              <span
                className="signup-link"
                onClick={() => navigate(ROUTES.createStudio)}>
                Skapa studio
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
