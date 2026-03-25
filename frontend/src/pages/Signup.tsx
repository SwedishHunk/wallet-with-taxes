import { useState } from "react";
import { signup } from "../lib/users";
import { useNavigate } from "react-router-dom";
import "../style/Login.css";
import "../style/Bright.css";
import { ROUTES } from "../routes";

export default function Signup() {
  console.log("🔵 SIGNUP COMPONENT RENDERING");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gdprConsent, setGdprConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<null | {
    type: "success" | "error";
    text: string;
  }>(null);
  const navigate = useNavigate();

  const handleSignup = async () => {
    if (!email || !password) {
      setMessage({ type: "error", text: "Please enter email and password" });
      return;
    }
    if (!gdprConsent) {
      setMessage({ type: "error", text: "You must accept the data processing terms to continue." });
      return;
    }
    setLoading(true);
    try {
      await signup(email, password, gdprConsent);
      // Signup successful - redirect to login
      navigate(ROUTES.root);
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Signup failed. Please try again.";
      setMessage({ type: "error", text: errorMessage });
      console.error(err);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSignup();
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <h1 className="login-title">Create your account</h1>
        <div style={{ minHeight: 44 }}>
          {message && (
            <div
              className={`bright-alert ${message.type === "success" ? "bright-alert-success" : "bright-alert-error"}`}>
              {message.text}
            </div>
          )}
        </div>
        <div className="login-fields">
          <input
            type="email"
            placeholder="Email"
            className="login-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <input
            type="password"
            placeholder="Password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#aaa", cursor: "pointer", lineHeight: 1.5 }}>
            <input
              type="checkbox"
              checked={gdprConsent}
              onChange={(e) => setGdprConsent(e.target.checked)}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            I agree that Triolith may process my personal data (email address, wallet address, and transaction history) to provide the platform and tax reporting service. You can request deletion or export of your data at any time.
          </label>
          <button
            onClick={handleSignup}
            className="login-button"
            disabled={loading || !gdprConsent}>
            {loading ? "Creating..." : "Sign Up"}
          </button>
        </div>
        <p className="login-footer">
          Already have an account?{" "}
          <span className="signup-link" onClick={() => navigate(ROUTES.root)}>
            Sign in
          </span>
        </p>
      </div>
    </div>
  );
}
