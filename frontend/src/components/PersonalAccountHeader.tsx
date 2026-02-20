import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getStudios } from "../lib/users";
import { ROUTES } from "../routes";
import type { Studio } from "../types/studio";
import type { PersonalUser } from "../types/user";

interface PersonalAccountHeaderProps {
  studioName?: string;
  onLogoutPersonal?: () => void;
}

export default function PersonalAccountHeader({
  studioName,
  onLogoutPersonal,
}: PersonalAccountHeaderProps) {
  const [personalUser, setPersonalUser] = useState<PersonalUser | null>(null);
  const [resolvedStudioName, setResolvedStudioName] = useState<
    string | undefined
  >(studioName);
  const [showNotification, setShowNotification] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem("personalUser");
    if (stored) {
      try {
        setPersonalUser(JSON.parse(stored));
      } catch (err) {
        console.error("Failed to parse personal user:", err);
      }
    }
  }, []);

  useEffect(() => {
    // If no studioName provided, try to resolve via API using studioId
    const resolveStudio = async () => {
      try {
        const studioId = localStorage.getItem("studioId");
        if (!studioId) return;
        const res = await getStudios();
        const studios: Studio[] = res.data || [];
        const match = studios.find((s) => String(s.id) === String(studioId));
        if (match) setResolvedStudioName(match.name || match.email || "Studio");
      } catch {
        // Fallback to generic label
        setResolvedStudioName(studioName || "Studio");
      }
    };

    if (!studioName) {
      void resolveStudio();
    } else {
      setResolvedStudioName(studioName);
    }
  }, [studioName]);

  const handleLogout = () => {
    localStorage.removeItem("personalUser");
    setShowNotification(true);

    // Wait 1 second to show notification, then redirect
    setTimeout(() => {
      if (onLogoutPersonal) {
        onLogoutPersonal();
      } else {
        navigate(ROUTES.accountLogin);
      }
    }, 1000);
  };

  if (!personalUser) return null;

  return (
    <>
      {showNotification && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            backgroundColor: "#4caf50",
            color: "white",
            padding: "16px 24px",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            zIndex: 9999,
            fontWeight: 600,
          }}>
          ✓ Logged out successfully
        </div>
      )}
      <div
        style={{
          backgroundColor: "#f5f5f5",
          borderBottom: "1px solid #ddd",
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}>
        <div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--muted)",
              textTransform: "uppercase",
            }}>
            {resolvedStudioName ? `STUDIO: ${resolvedStudioName}` : "STUDIO"}
          </div>
          <div style={{ fontSize: "14px", fontWeight: 600, marginTop: "4px" }}>
            📧 {personalUser.email}
          </div>
          {personalUser.role && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--muted)",
                marginTop: "2px",
              }}>
              Role: {personalUser.role.toUpperCase()}
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="btn btn-secondary"
          style={{ marginBottom: 0 }}>
          Logout Personal Account
        </button>
      </div>
    </>
  );
}
