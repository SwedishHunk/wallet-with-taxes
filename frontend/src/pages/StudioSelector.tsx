import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthState } from "../lib/AuthContext";
import { useLoginStudio } from "../lib/useAuth";
import { getStudios, selectStudio, logout } from "../lib/users";
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
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { authContext } = useAuthState();
  const { loginStudio } = useLoginStudio();

  useEffect(() => {
    // If the user already has an active studio session, send them to the dashboard.
    if (authContext.state !== "Unauthenticated") {
      navigate(ROUTES.dashboard, { replace: true });
      return;
    }
    void loadStudios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, authContext.state]);

  const loadStudios = async () => {
    try {
      setLoading(true);
      const res = await getStudios();
      const list: Studio[] = res.data ?? [];
      setStudios(list);

      // If only one studio was returned the user still ended up here
      // (e.g. via a direct URL). Auto-select it for them.
      if (list.length === 1) {
        await handleSelectStudio(list[0].id);
      }
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to load studios",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStudio = async (studioId: string) => {
    try {
      setSelecting(studioId);
      const { data } = await selectStudio(studioId);
      // Cookie is updated server-side. Record the non-sensitive session info
      // in React state / sessionStorage for UI display only.
      loginStudio({
        studioId: data.studioId,
        studioName: data.studioName,
        authenticatedAt: new Date().toISOString(),
        isTriolithAdmin: data.isTriolithAdmin ?? false,
      });
      navigate(
        data.isTriolithAdmin ? ROUTES.triolithAdmin : ROUTES.dashboard,
        { replace: true },
      );
    } catch (err) {
      console.error("Error selecting studio:", err);
      setError("Failed to select studio. Please try again.");
    } finally {
      setSelecting(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate(ROUTES.root);
    }
  };

  if (loading)
    return <div style={{ padding: "20px" }}>Loading your studios...</div>;

  if (error) {
    return (
      <div style={{ padding: "24px", maxWidth: "600px", margin: "0 auto" }}>
        <div className="bright-alert bright-alert-error">{error}</div>
        <button
          onClick={() => void handleLogout()}
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
        <p style={{ color: "var(--muted)", marginTop: "8px" }}>
          Your account has access to multiple studios. Choose one to continue.
        </p>
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
              onClick={() => void handleSelectStudio(studio.id)}
              className="bright-card"
              style={{
                cursor: selecting ? "wait" : "pointer",
                opacity: selecting && selecting !== studio.id ? 0.5 : 1,
                transition: "all 0.2s ease",
                padding: "20px",
              }}
              onMouseEnter={(e) => {
                if (!selecting) {
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(0,0,0,0.15)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }
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
                  <p style={{ margin: "0", color: "var(--muted)", fontSize: "14px" }}>
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
                <div style={{ fontSize: "28px" }}>
                  {selecting === studio.id ? "⏳" : "→"}
                </div>
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
        onClick={() => void handleLogout()}
        className="bright-button bright-button-danger"
        style={{ marginTop: "32px", width: "100%" }}>
        Logout
      </button>
    </div>
  );
}
