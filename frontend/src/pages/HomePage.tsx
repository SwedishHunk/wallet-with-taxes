import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../routes";
import { getPersonalAccounts } from "../lib/platform";
import SafeCyberpunkScene from "../components/3d/SafeCyberpunkScene";
import { useGsapEntrance, useGsapStagger } from "../hooks/useGsapEntrance";

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

  // GSAP entrance animations
  const headerRef = useGsapEntrance<HTMLHeadingElement>({
    y: -20,
    duration: 0.8,
    delay: 0.2,
  });
  const subtitleRef = useGsapEntrance<HTMLParagraphElement>({
    y: 20,
    opacity: 0,
    duration: 0.7,
    delay: 0.4,
  });
  const accountsRef = useGsapStagger<HTMLDivElement>({
    y: 25,
    scale: 0.96,
    stagger: 0.1,
    delay: 0.5,
  });
  const actionsRef = useGsapStagger<HTMLDivElement>({
    y: 20,
    opacity: 0,
    stagger: 0.12,
    delay: 0.7,
  });

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await getPersonalAccounts();
        setPersonalAccounts(response.data);
      } catch (err: unknown) {
        console.error("Error fetching accounts:", err);
        setError(
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || "Failed to load accounts",
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
    sessionStorage.removeItem("personalUser");
    navigate(ROUTES.root);
  };

  const handleLoginToAccount = (email: string) => {
    navigate(ROUTES.accountLogin, { state: { email } });
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          position: "relative",
          zIndex: 1,
        }}
      >
        <SafeCyberpunkScene intensity="subtle" sacredGeometry="fibonacci" />
        <div style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 3D Background */}
      <SafeCyberpunkScene intensity="full" sacredGeometry="flower" />

      {/* Content overlay */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "40px 20px",
        }}
      >
        {/* Glassmorphism card */}
        <div
          style={{
            maxWidth: "500px",
            width: "100%",
            background: "rgba(15, 12, 30, 0.65)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255, 215, 0, 0.15)",
            borderRadius: "20px",
            padding: "2.5rem 2rem",
            boxShadow:
              "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 60px rgba(0, 212, 255, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          }}
        >
          {/* Header */}
          <h2
            ref={headerRef}
            style={{
              textAlign: "center",
              fontSize: "1.8rem",
              fontWeight: 700,
              background: "linear-gradient(135deg, #ffd700 0%, #00d4ff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: "0.25rem",
            }}
          >
            Welcome to Your Studio
          </h2>

          <p
            ref={subtitleRef}
            style={{
              textAlign: "center",
              color: "rgba(255, 255, 255, 0.5)",
              fontSize: "0.85rem",
              marginBottom: "2rem",
            }}
          >
            Select your account to continue
          </p>

          {error && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "10px",
                padding: "0.75rem 1rem",
                marginBottom: "1rem",
                color: "#ff6b6b",
                fontSize: "0.875rem",
              }}
            >
              {error}
            </div>
          )}

          {personalAccounts.length === 0 ? (
            <div>
              <p
                style={{
                  color: "rgba(255, 255, 255, 0.6)",
                  textAlign: "center",
                  marginBottom: "1.5rem",
                }}
              >
                No personal accounts created yet. Create your first account to
                get started.
              </p>
              <button
                onClick={handleCreateFirstAccount}
                style={{
                  width: "100%",
                  padding: "14px",
                  background:
                    "linear-gradient(135deg, #ffd700 0%, #ffbf00 100%)",
                  border: "none",
                  borderRadius: "12px",
                  color: "#0a0a1a",
                  fontWeight: 700,
                  fontSize: "1rem",
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  boxShadow: "0 4px 15px rgba(255, 215, 0, 0.25)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 25px rgba(255, 215, 0, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 15px rgba(255, 215, 0, 0.25)";
                }}
              >
                Create First Account
              </button>
            </div>
          ) : (
            <div>
              {/* Account cards */}
              <div
                ref={accountsRef}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {personalAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => handleLoginToAccount(account.email)}
                    style={{
                      padding: "16px 18px",
                      background: "rgba(255, 255, 255, 0.04)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "14px",
                      cursor: "pointer",
                      transition:
                        "transform 0.2s, background 0.2s, border-color 0.2s, box-shadow 0.2s",
                      textAlign: "left",
                      color: "inherit",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform =
                        "translateY(-2px) scale(1.01)";
                      e.currentTarget.style.background =
                        "rgba(255, 215, 0, 0.06)";
                      e.currentTarget.style.borderColor =
                        "rgba(255, 215, 0, 0.25)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 20px rgba(255, 215, 0, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform =
                        "translateY(0) scale(1)";
                      e.currentTarget.style.background =
                        "rgba(255, 255, 255, 0.04)";
                      e.currentTarget.style.borderColor =
                        "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      {/* Avatar */}
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "12px",
                          background:
                            "linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(0, 212, 255, 0.2))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1rem",
                          fontWeight: 700,
                          color: "#ffd700",
                          flexShrink: 0,
                        }}
                      >
                        {account.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "0.95rem",
                            color: "rgba(255, 255, 255, 0.9)",
                          }}
                        >
                          {account.email}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "rgba(255, 255, 255, 0.4)",
                            marginTop: "2px",
                            textTransform: "capitalize",
                          }}
                        >
                          {account.role}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div
                ref={actionsRef}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  marginTop: "1.5rem",
                }}
              >
                {personalAccounts.some((a) => a.role === "admin") && (
                  <button
                    onClick={() => navigate(ROUTES.personalAccounts)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: "rgba(255, 255, 255, 0.06)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "12px",
                      color: "rgba(255, 255, 255, 0.7)",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      transition: "background 0.2s, border-color 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255, 255, 255, 0.1)";
                      e.currentTarget.style.borderColor =
                        "rgba(255, 255, 255, 0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255, 255, 255, 0.06)";
                      e.currentTarget.style.borderColor =
                        "rgba(255, 255, 255, 0.1)";
                    }}
                  >
                    Manage Accounts
                  </button>
                )}

                <button
                  onClick={handleLogoutAll}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "transparent",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    borderRadius: "12px",
                    color: "rgba(239, 68, 68, 0.7)",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    transition: "background 0.2s, color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "rgba(239, 68, 68, 0.1)";
                    e.currentTarget.style.color = "#ef4444";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "rgba(239, 68, 68, 0.7)";
                  }}
                >
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
