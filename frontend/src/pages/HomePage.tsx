import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../routes";
import { getPersonalAccounts } from "../lib/platform";
import { setAuthToken } from "../lib/api";

interface PersonalAccount {
  id: string;
  email: string;
  role: "admin" | "member";
  accessPoints: Record<string, boolean>;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [personalAccounts, setPersonalAccounts] = useState<PersonalAccount[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await getPersonalAccounts();
        setPersonalAccounts(response.data);
      } catch (err: unknown) {
        console.error("Error fetching accounts:", err);
        setError(
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || "Failed to load accounts"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  const handleCreateFirstAccount = () => {
    navigate(ROUTES.createFirstAccount);
  };

  const handleLogoutAll = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("studioId");
    localStorage.removeItem("personalUser");
    setAuthToken(null);
    navigate(ROUTES.root);
  };

  const handleLoginToAccount = (email: string) => {
    navigate(ROUTES.accountLogin, { state: { email } });
  };

  if (loading) {
    return <div className="container">Loading...</div>;
  }

  return (
    <div className="container" style={{ marginTop: "40px" }}>
      <div className="card" style={{ maxWidth: "600px", margin: "0 auto" }}>
        <div className="card-header">
          <h2>Welcome to Your Studio</h2>
        </div>
        <div className="card-body">
          {error && <div className="alert alert-error">{error}</div>}

          {personalAccounts.length === 0 ? (
            // No accounts yet - show create first account
            <div>
              <p>
                No personal accounts created yet. Create your first account to
                get started.
              </p>
              <button
                onClick={handleCreateFirstAccount}
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "20px" }}>
                Create First Account
              </button>
            </div>
          ) : (
            // Accounts exist - show login options
            <div>
              <p style={{ marginBottom: "30px" }}>
                Select an account to log in:
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}>
                {personalAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => handleLoginToAccount(account.email)}
                    className="btn"
                    style={{
                      padding: "15px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      cursor: "pointer",
                      backgroundColor: "#f5f5f5",
                      transition: "background-color 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#e8e8e8")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "#f5f5f5")
                    }>
                    <div style={{ textAlign: "left" }}>
                      <strong>{account.email}</strong>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--muted)",
                          marginTop: "4px",
                        }}>
                        Role: {account.role}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {personalAccounts.some((a) => a.role === "admin") && (
                <button
                  onClick={() => navigate(ROUTES.personalAccounts)}
                  className="btn btn-secondary"
                  style={{ width: "100%", marginTop: "20px" }}>
                  Manage Accounts
                </button>
              )}

              <button
                onClick={handleLogoutAll}
                className="btn btn-secondary"
                style={{ width: "100%", marginTop: "12px" }}>
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
