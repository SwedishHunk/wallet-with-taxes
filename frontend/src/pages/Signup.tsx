import { useState } from "react";
import { signup } from "../lib/users";
import { setAuthToken } from "../lib/api";
import { useNavigate } from "react-router-dom";
import "../style/Login.css";
import "../style/Bright.css";
import { ROUTES } from "../routes";

export default function Signup() {
  console.log("🔵 SIGNUP COMPONENT RENDERING");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    setLoading(true);
    try {
      await signup(email, password);
      // Signup successful - redirect to login
      navigate(ROUTES.root);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || "Signup failed. Please try again.";
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
          <button
            onClick={handleSignup}
            className="login-button"
            disabled={loading}>
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
