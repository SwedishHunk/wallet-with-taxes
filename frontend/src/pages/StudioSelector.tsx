import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthState } from "../lib/AuthContext";
import { getStudios } from "../lib/users";
import { getPersonalAccounts } from "../lib/platform";
import { setAuthToken } from "../lib/api";
import { ROUTES } from "../routes";
import "../style/Bright.css";

interface Studio {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
}

export default function StudioSelector() {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { authContext } = useAuthState();

  useEffect(() => {
    // Redirect if already in a studio session
    if (authContext.state !== "Unauthenticated") {
      navigate(ROUTES.dashboard, { replace: true });
      return;
    }

    const token = sessionStorage.getItem("token") ?? localStorage.getItem("token");
    if (!token) {
      navigate(ROUTES.root);
      return;
    }
    setAuthToken(token);

    loadStudios();
  }, [navigate, authContext.state]);

  const loadStudios = async () => {
    try {
      setLoading(true);
      const res = await getStudios();
      setStudios(res.data || []);

      // If only one studio, auto-select it
      if (res.data && res.data.length === 1) {
        selectStudio(res.data[0].id);
      }
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to load studios"
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectStudio = async (studioId: string) => {
    localStorage.setItem("studioId", studioId);

    try {
      // Check if personal accounts exist
      const res = await getPersonalAccounts();
      const personalAccounts = res.data || [];

      if (personalAccounts.length === 0) {
        // No accounts - go to create first account
        navigate(ROUTES.createFirstAccount);
      } else {
        // Accounts exist - go to personal account login
        navigate(ROUTES.accountLogin);
      }
    } catch (err) {
      console.error("Error checking personal accounts:", err);
      // On error, go to create first account as fallback
      navigate(ROUTES.createFirstAccount);
    }
  };

  if (loading)
    return <div style={{ padding: "20px" }}>Loading your studios...</div>;

  if (error) {
    return (
      <div style={{ padding: "24px", maxWidth: "600px", margin: "0 auto" }}>
        <div className="bright-alert bright-alert-error">{error}</div>
        <button
          onClick={() => {
            localStorage.removeItem("token");
            setAuthToken(null);
            navigate(ROUTES.root);
          }}
          className="bright-button bright-button-secondary"
          style={{ marginTop: "16px" }}>
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "600px", margin: "0 auto" }}>
      <div className="bright-header" style={{ marginBottom: "32px" }}>
        <h1>Select a Studio</h1>
      </div>

      {studios.length === 0 ? (
        <div className="bright-card">
          <p className="bright-text-secondary">
            No studios found. Create your first one!
          </p>
          <button
            onClick={() => navigate(ROUTES.createStudio)}
            className="bright-button bright-button-primary"
            style={{ marginTop: "16px" }}>
            Create First Studio
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {studios.map((studio) => (
            <div
              key={studio.id}
              onClick={() => selectStudio(studio.id)}
              className="bright-card"
              style={{
                cursor: "pointer",
                transition: "all 0.2s ease",
                padding: "20px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                <div>
                  <h3
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "18px",
                      fontWeight: "600",
                    }}>
                    {studio.name}
                  </h3>
                  <p
                    style={{
                      margin: "0",
                      color: "var(--muted)",
                      fontSize: "14px",
                    }}>
                    {studio.email}
                  </p>
                  <div style={{ marginTop: "8px" }}>
                    <span
                      className={`bright-badge ${
                        studio.role === "owner"
                          ? "bright-badge-success"
                          : studio.role === "admin"
                            ? "bright-badge-info"
                            : "bright-badge-secondary"
                      }`}
                      style={{ fontSize: "12px" }}>
                      {studio.role.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: "28px" }}>→</div>
              </div>
            </div>
          ))}

          <button
            onClick={() => navigate(ROUTES.createStudio)}
            className="bright-button bright-button-secondary"
            style={{ marginTop: "24px", width: "100%" }}>
            + Create New Studio
          </button>
        </div>
      )}

      <button
        onClick={() => {
          localStorage.removeItem("token");
          localStorage.removeItem("studioId");
          setAuthToken(null);
          navigate(ROUTES.root);
        }}
        className="bright-button bright-button-danger"
        style={{ marginTop: "32px", width: "100%" }}>
        Logout
      </button>
    </div>
  );
}
