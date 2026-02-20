import { useState, useEffect, useMemo } from "react";
import { ROUTES } from "../routes";
import { useNavigate, useLocation } from "react-router-dom";
import {
  loginPersonalAccount,
  getPersonalAccounts,
  createPersonalAccount,
} from "../lib/platform";

export default function PersonalAccountLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState<string>(
    (location.state?.email as string) || "",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<
    Array<{ id: string; email: string; role: string }>
  >([]);
  const [mode, setMode] = useState<"login" | "create">(() => {
    const stateMode = location.state?.mode;
    return stateMode === "create" || stateMode === "login" ? stateMode : "login";
  });
  const [createEmail, setCreateEmail] = useState(
    (location.state?.email as string) || "",
  );
  const [createPassword, setCreatePassword] = useState("");
  const [createConfirm, setCreateConfirm] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    // Load available personal accounts for this studio so user can pick one and log in
    const fetchAccounts = async () => {
      try {
        const res = await getPersonalAccounts();
        setAccounts(res.data || []);
        if (!email && res.data && res.data.length === 1) {
          setEmail(res.data[0].email);
        }
        if ((res.data?.length || 0) === 0) {
          setMode("create");
        }
      } catch (err) {
        console.error("Error loading personal accounts", err);
      }
    };

    fetchAccounts();
  }, [email]);

  const disableSubmit = useMemo(
    () => loading || createLoading,
    [loading, createLoading],
  );

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);
    try {
      const response = await loginPersonalAccount({ email, password });

      // Store the personal account info in localStorage
      localStorage.setItem(
        "personalUser",
        JSON.stringify({
          id: response.data.id,
          email: response.data.email,
          role: response.data.role,
          accessPoints: response.data.accessPoints,
        }),
      );

      // Redirect to dashboard
      navigate(ROUTES.dashboard);
    } catch (err: unknown) {
      console.error("Error logging in:", err);
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Invalid credentials. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!createEmail || !createPassword) {
      setError("Email and password are required");
      return;
    }

    if (createPassword !== createConfirm) {
      setError("Passwords do not match");
      return;
    }

    if (createPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setCreateLoading(true);
    try {
      await createPersonalAccount({
        email: createEmail,
        password: createPassword,
      });
      setMessage("Account created successfully. Please log in.");
      setEmail(createEmail);
      setPassword("");
      setMode("login");
      // Refresh account list
      const res = await getPersonalAccounts();
      setAccounts(res.data || []);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to create account. Please try again."
      );
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="container" style={{ marginTop: "40px" }}>
      <div className="card" style={{ maxWidth: "500px", margin: "0 auto" }}>
        <div className="card-header">
          <h2>Personal Accounts</h2>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "13px",
              color: "var(--muted)",
            }}>
            {mode === "login"
              ? "Select or enter a personal account to log in."
              : "Create a new personal account for this studio."}
          </p>
        </div>
        <div className="card-body">
          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}

          {accounts.length > 0 && (
            <div
              style={{
                marginBottom: "12px",
                fontSize: "13px",
                color: "var(--muted)",
              }}>
              {mode === "login"
                ? "Need to create another? "
                : "Already have one? "}
              <button
                type="button"
                className="link-button"
                onClick={() => setMode(mode === "login" ? "create" : "login")}
                disabled={disableSubmit}
                style={{ padding: 0, marginLeft: "4px" }}>
                {mode === "login" ? "Create account" : "Log in instead"}
              </button>
            </div>
          )}

          {accounts.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontWeight: 600, marginBottom: "8px" }}>
                Select an account to fill email:
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}>
                {accounts.map((acct) => (
                  <button
                    key={acct.id}
                    type="button"
                    className="btn"
                    style={{ textAlign: "left" }}
                    onClick={() => setEmail(acct.email)}>
                    <div>
                      <strong>{acct.email}</strong>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                      Role: {acct.role}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "login" && (
            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginTop: "12px" }}>
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "20px" }}>
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>
          )}

          {mode === "create" && (
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label htmlFor="createEmail">Email Address</label>
                <input
                  type="email"
                  id="createEmail"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={createLoading}
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginTop: "12px" }}>
                <label htmlFor="createPassword">Password</label>
                <input
                  type="password"
                  id="createPassword"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Enter password"
                  disabled={createLoading}
                />
              </div>

              <div className="form-group" style={{ marginTop: "12px" }}>
                <label htmlFor="createConfirm">Confirm Password</label>
                <input
                  type="password"
                  id="createConfirm"
                  value={createConfirm}
                  onChange={(e) => setCreateConfirm(e.target.value)}
                  placeholder="Confirm password"
                  disabled={createLoading}
                />
              </div>

              <button
                type="submit"
                disabled={createLoading}
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "20px" }}>
                {createLoading ? "Creating..." : "Create account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
