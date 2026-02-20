import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../routes";
import { signup } from "../lib/users";
import { setAuthToken } from "../lib/api";
import { useLoginStudio, useLoginMember } from "../lib/useAuth";
import "../style/Bright.css";
import "../style/Login.css";

export default function CreateStudio() {
  const navigate = useNavigate();
  const { loginStudio } = useLoginStudio();
  const { loginMember } = useLoginMember();

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
      setError("Studio name cannot be empty");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Valid email is required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { data } = await signup(email, password, studioName);

      // Save token
      setAuthToken(data.token);
      localStorage.setItem("token", data.token);

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
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create studio";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box" style={{ maxWidth: "500px" }}>
        <h1 className="login-title">Skapa studio</h1>

        <form className="login-fields" onSubmit={handleSubmit}>
          {error && (
            <div className="bright-alert bright-alert-error">{error}</div>
          )}

          <input
            type="text"
            placeholder="Studio name"
            className="login-input"
            value={studioName}
            onChange={(e) => setStudioName(e.target.value)}
            required
            autoFocus
          />

          <input
            type="email"
            placeholder="Email"
            className="login-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <input
            type="password"
            placeholder="Confirm password"
            className="login-input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? "Skapar studio..." : "Skapa studio"}
          </button>
        </form>

        <p className="login-footer">
          Har du redan ett konto?{" "}
          <span className="signup-link" onClick={() => navigate(ROUTES.login)}>
            Logga in
          </span>
        </p>
      </div>
    </div>
  );
}
