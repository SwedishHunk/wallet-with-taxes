import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthState } from "../lib/AuthContext";
import { getMemberSession, getMembersCount } from "../lib/users";
import { ROUTES } from "../routes";
import { Page, PageHeader, Card, Button, Badge } from "../components/ui/index";
import "../style/Login.css";
import "../style/Bright.css";

interface StudioMember {
  memberId: string;
  userId: string;
  email: string;
  isOwner: boolean;
  permissions?: string[];
  gameAccessIds?: string[];
}

type ApiError = { response?: { data?: { message?: string } } };

export default function MemberLogin() {
  const navigate = useNavigate();
  const { authContext, isLoading, setMemberSession } = useAuthState();

  const [members, setMembers] = useState<StudioMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingMember, setLoadingMember] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to load before redirecting
    if (isLoading) return;

    // Redirect if already fully authenticated
    if (authContext.state === "Studio+MemberActive") {
      navigate(ROUTES.dashboard, { replace: true });
      return;
    }

    // Must have studio session
    if (!authContext.studioSession) {
      navigate(ROUTES.login, { replace: true });
      return;
    }

    // Load members
    loadMembers();
  }, [authContext.state, authContext.studioSession, isLoading, navigate]);

  const loadMembers = async () => {
    try {
      setLoadingMembers(true);
      setError(null);

      if (!authContext.studioSession) return;

      const membersData = await getMembersCount(
        authContext.studioSession.studioId,
      );
      setMembers(membersData.data || []);
    } catch (err) {
      const apiErr = err as ApiError;
      const message =
        apiErr.response?.data?.message || "Kunde inte ladda medlemmar";
      setError(message);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSelectMember = async (member: StudioMember) => {
    try {
      setLoadingMember(member.memberId);
      setError(null);

      if (!authContext.studioSession) return;

      // Activate this member
      const memberData = await getMemberSession(
        authContext.studioSession.studioId,
      );

      // Update auth with this member
      setMemberSession({
        memberId: memberData.data.memberId,
        userId: memberData.data.userId,
        studioId: memberData.data.studioId,
        email: memberData.data.email,
        isOwner: memberData.data.isOwner,
        permissions: memberData.data.permissions ?? [],
        gameAccessIds: memberData.data.gameAccessIds ?? [],
        authenticatedAt: new Date().toISOString(),
      });

      console.log("[MemberLogin] Selected member:", member.email);
      navigate(ROUTES.dashboard, { replace: true });
    } catch (err) {
      const apiErr = err as ApiError;
      const message =
        apiErr.response?.data?.message || "Kunde inte aktivera medlem";
      setError(message);
      setLoadingMember(null);
    }
  };

  if (isLoading || loadingMembers) {
    return (
      <Page>
        <PageHeader title="Laddar..." />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Välj medlem"
        subtitle={`Studio: ${authContext.studioSession?.studioName ?? ""}`}
      />

      <Card style={{ maxWidth: "500px", margin: "0 auto" }}>
        {error && (
          <div
            className="bright-alert bright-alert-error"
            style={{ marginBottom: "1rem" }}>
            <div>{error}</div>
            <button
              type="button"
              className="login-alert-close"
              onClick={() => setError(null)}
              style={{
                marginLeft: "auto",
                background: "none",
                border: "none",
                color: "inherit",
                cursor: "pointer",
              }}>
              ✕
            </button>
          </div>
        )}

        {members.length === 0 ? (
          <p>Inga medlemmar tillgängliga</p>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {members.map((member) => (
              <button
                key={member.memberId}
                onClick={() => handleSelectMember(member)}
                disabled={loadingMember === member.memberId}
                style={{
                  padding: "12px 16px",
                  background: "var(--surface2)",
                  border: "1px solid var(--surface2)",
                  borderRadius: "6px",
                  color: "var(--text)",
                  cursor:
                    loadingMember === member.memberId
                      ? "not-allowed"
                      : "pointer",
                  opacity: loadingMember === member.memberId ? 0.6 : 1,
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{member.email}</div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--muted)",
                      marginTop: "4px",
                    }}>
                    ID: {member.memberId}
                  </div>
                </div>
                {member.isOwner && <Badge variant="owner">Owner</Badge>}
              </button>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}
