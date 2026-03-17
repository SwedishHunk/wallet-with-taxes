import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  createPersonalAccount,
  getPersonalAccounts,
  updatePersonalAccountPermissions,
} from "../lib/platform";
import { setAuthToken } from "../lib/api";
import PersonalAccountHeader from "../components/PersonalAccountHeader";
import { ROUTES } from "../routes";
import "../style/Bright.css";
import "../style/Dashboard.css";

interface PersonalAccount {
  id: string;
  email: string;
  role: "admin" | "member";
  accessPoints: Record<string, boolean>;
  createdAt: string;
}

export default function PersonalAccounts() {
  const [accounts, setAccounts] = useState<PersonalAccount[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAccessPoints, setEditAccessPoints] = useState<
    Record<string, boolean>
  >({});
  const navigate = useNavigate();

  const token = sessionStorage.getItem("token") ?? localStorage.getItem("token");
  const handleLogoutPersonal = () => {
    // Clear form and reset to fresh state
    setEmail("");
    setPassword("");
    setMessage(null);
    setEditingId(null);
    setEditAccessPoints({});
  };
  const personalUser = sessionStorage.getItem("personalUser");

  useEffect(() => {
    if (!token) {
      navigate(ROUTES.root);
      return;
    }

    // Set auth token in axios headers on mount or when token changes
    setAuthToken(token);

    // Check if personal user is logged in
    if (!personalUser) {
      navigate(ROUTES.home);
      return;
    }

    // Check if user has ADMIN role
    try {
      const user = JSON.parse(personalUser);
      if (user.role !== "admin") {
        navigate(ROUTES.dashboard);
        return;
      }
    } catch {
      navigate(ROUTES.home);
      return;
    }

    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data } = await getPersonalAccounts();
      setAccounts(data);
    } catch (err) {
      console.error("Error fetching accounts:", err);
    }
  };

  const handleCreate = async () => {
    if (!email || !password) {
      setMessage({ type: "error", text: "Please enter email and password" });
      return;
    }

    setLoading(true);
    try {
      await createPersonalAccount({ email, password });
      setMessage({
        type: "success",
        text: "Personal account created successfully!",
      });
      setEmail("");
      setPassword("");
      fetchAccounts();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to create account" });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPermissions = (account: PersonalAccount) => {
    setEditingId(account.id);
    setEditAccessPoints({ ...account.accessPoints });
  };

  const handleSavePermissions = async (userId: string) => {
    try {
      await updatePersonalAccountPermissions(userId, editAccessPoints);
      setMessage({
        type: "success",
        text: "Permissions updated successfully!",
      });
      setEditingId(null);
      fetchAccounts();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to update permissions" });
      console.error(err);
    }
  };

  const handleToggleAccessPoint = (key: string) => {
    setEditAccessPoints((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div>
      <PersonalAccountHeader onLogoutPersonal={handleLogoutPersonal} />
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}>
          <h1 className="dashboard-title">Personal Accounts</h1>
          <button
            onClick={() => navigate(ROUTES.dashboard)}
            className="bright-button bright-button-secondary">
            Back to Dashboard
          </button>
        </div>

        <div
          className="border p-4 rounded shadow"
          style={{ marginBottom: "24px" }}>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: "600",
              marginBottom: "16px",
            }}>
            Create Personal Account
          </h2>
          <div style={{ minHeight: 44 }}>
            {message && (
              <div
                className={`bright-alert ${message.type === "success" ? "bright-alert-success" : "bright-alert-error"}`}
                style={{ marginBottom: "12px" }}>
                {message.text}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
            <input
              type="email"
              placeholder="Email"
              className="login-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="password"
              placeholder="Password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              onClick={handleCreate}
              className="bright-button"
              disabled={loading}>
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </div>

        <div className="border p-4 rounded shadow">
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: "600",
              marginBottom: "16px",
            }}>
            Team Members
          </h2>
          {accounts.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No personal accounts yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {accounts.map((account) => (
                <div
                  key={account.id}
                  style={{
                    padding: "12px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                  }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}>
                    <div>
                      <div style={{ fontWeight: "600" }}>{account.email}</div>
                      <div
                        style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
                        Role:{" "}
                        <span style={{ fontWeight: "600" }}>
                          {account.role}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        editingId === account.id
                          ? handleSavePermissions(account.id)
                          : handleEditPermissions(account)
                      }
                      className="bright-button bright-button-secondary"
                      style={{ fontSize: "0.875rem" }}>
                      {editingId === account.id ? "Save" : "Edit Permissions"}
                    </button>
                  </div>

                  {editingId === account.id && (
                    <div
                      style={{
                        marginTop: "12px",
                        paddingTop: "12px",
                        borderTop: "1px solid #eee",
                      }}>
                      <div
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: "600",
                          marginBottom: "8px",
                        }}>
                        Access Points:
                      </div>
                      <div style={{ display: "grid", gap: "8px" }}>
                        {Object.keys(editAccessPoints).length === 0 ? (
                          <div
                            style={{
                              fontSize: "0.875rem",
                              color: "var(--muted)",
                            }}>
                            No access points configured
                          </div>
                        ) : (
                          Object.entries(editAccessPoints).map(
                            ([key, value]) => (
                              <label
                                key={key}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  fontSize: "0.875rem",
                                  cursor: "pointer",
                                }}>
                                <input
                                  type="checkbox"
                                  checked={value}
                                  onChange={() => handleToggleAccessPoint(key)}
                                  style={{ cursor: "pointer" }}
                                />
                                {key}
                              </label>
                            ),
                          )
                        )}
                      </div>
                      <button
                        onClick={() => setEditingId(null)}
                        className="bright-button bright-button-secondary"
                        style={{ fontSize: "0.875rem", marginTop: "8px" }}>
                        Cancel
                      </button>
                    </div>
                  )}

                  {editingId !== account.id && (
                    <div style={{ fontSize: "0.875rem", color: "#999" }}>
                      Access Points:{" "}
                      {
                        Object.values(account.accessPoints).filter(Boolean)
                          .length
                      }
                      /{Object.keys(account.accessPoints).length}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
