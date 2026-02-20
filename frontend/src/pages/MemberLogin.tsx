import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Page } from "../components/ui/Page";
import { PageHeader } from "../components/ui/PageHeader";

import { ROUTES } from "../routes";
import { useAuthState } from "../lib/AuthContext";
import { setAuthToken } from "../lib/api";
import { getMemberSession, getMembersCount, login } from "../lib/users";

type ApiError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

type StudioMember = {
  memberId?: string;
  id?: string; // API kan skicka id istället
  userId?: string;
  email: string;
  isOwner: boolean;
  role?: string;
  permissions?: string[];
  gameAccessIds?: string[];
};

export default function MemberLogin() {
  const navigate = useNavigate();
  const { authContext, isLoading, setMemberSession, setStudioSession } =
    useAuthState();

  const [members, setMembers] = useState<StudioMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [selectedMember, setSelectedMember] = useState<StudioMember | null>(
    null,
  );
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const studioId = authContext.studioSession?.studioId;

  const normalizedMembers = useMemo(() => {
    return members.map((m) => ({
      ...m,
      memberId: m.memberId ?? m.id, // normalisering
    }));
  }, [members]);

  useEffect(() => {
    if (isLoading) return;

    // Om redan full auth → dashboard
    if (authContext.state === "Studio+MemberActive") {
      navigate(ROUTES.dashboard, { replace: true });
      return;
    }

    // Måste ha studiosession
    if (!authContext.studioSession) {
      navigate(ROUTES.login, { replace: true });
      return;
    }

    if (!studioId) {
      setError("Studio saknar ID. Logga in igen.");
      setLoadingMembers(false);
      return;
    }

    void loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLoading,
    authContext.studioSession,
    authContext.state,
    navigate,
    studioId,
  ]);

  const loadMembers = async () => {
    try {
      setLoadingMembers(true);
      setError(null);

      if (!studioId) {
        setError("Studio saknar ID. Logga in igen.");
        return;
      }

      const membersData = await getMembersCount(studioId);
      const raw = membersData.data || [];

      const normalized = raw.map(
        (m: { memberId?: string; id?: string; email: string; isOwner: boolean }) => ({
          ...m,
          memberId: m.memberId ?? m.id,
        })
      );

      setMembers(normalized);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.response?.data?.message || "Kunde inte ladda medlemmar");
    } finally {
      setLoadingMembers(false);
    }
  };

  const handlePickMember = (member: StudioMember) => {
    setError(null);
    setSelectedMember(member);
    setPassword("");

    console.log("[MemberLogin] PICK member:", {
      email: member.email,
      memberId: member.memberId ?? member.id,
      isOwner: member.isOwner,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studioId) return;
    if (!selectedMember) {
      setError("Välj en medlem först.");
      return;
    }
    if (!password.trim()) {
      setError("Ange lösenord.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      console.log("[MemberLogin] LOGIN attempt:", {
        studioId,
        email: selectedMember.email,
      });

      // 1) Logga in som den valda usern i denna studio → få ny token
      const loginRes = await login(selectedMember.email, password, studioId);

      const token = loginRes.data?.token;
      if (!token) {
        throw new Error("Login saknar token i response.");
      }

      localStorage.setItem("token", token);
      setAuthToken(token);

      // Uppdatera studiosession om vi faktiskt har giltiga värden
      const nextStudioId =
        loginRes.data?.studioId ?? loginRes.data?.user?.studioId ?? studioId;
      const nextStudioName =
        loginRes.data?.studioName ??
        authContext.studioSession?.studioName ??
        "";

      if (nextStudioId) {
        setStudioSession({
          studioId: nextStudioId,
          studioName: nextStudioName,
          authenticatedAt: new Date().toISOString(),
        });
      }

      // 2) Hämta member-session baserat på nya token-usern
      const memberRes = await getMemberSession(studioId);

      console.log("[MemberLogin] member-session after login:", memberRes.data);

      setMemberSession({
        memberId: memberRes.data.memberId,
        userId: memberRes.data.userId,
        studioId: memberRes.data.studioId,
        email: memberRes.data.email,
        isOwner: memberRes.data.isOwner,
        permissions: memberRes.data.permissions ?? [],
        gameAccessIds: memberRes.data.gameAccessIds ?? [],
        authenticatedAt: new Date().toISOString(),
      });

      navigate(ROUTES.dashboard, { replace: true });
    } catch (err) {
      const apiErr = err as ApiError;
      const msg =
        apiErr.response?.data?.message ||
        (err instanceof Error ? err.message : "Inloggning misslyckades");
      setError(msg);
    } finally {
      setSubmitting(false);
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
        title="Logga in som medlem"
        subtitle={`Studio: ${authContext.studioSession?.studioName ?? ""}`}
      />

      <Card style={{ maxWidth: "560px", margin: "0 auto" }}>
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

        {/* Lista */}
        {normalizedMembers.length === 0 ? (
          <p>Inga medlemmar tillgängliga</p>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {normalizedMembers.map((member) => {
              const memberKey = member.memberId ?? member.email;

              const isSelected =
                selectedMember?.email === member.email &&
                (selectedMember?.memberId ?? selectedMember?.id) ===
                  (member.memberId ?? member.id);

              return (
                <button
                  key={memberKey}
                  type="button"
                  onClick={() => handlePickMember(member)}
                  style={{
                    padding: "12px 16px",
                    background: isSelected
                      ? "var(--surface3)"
                      : "var(--surface2)",
                    border: "1px solid var(--surface2)",
                    borderRadius: "6px",
                    color: "var(--text)",
                    cursor: "pointer",
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
                      ID: {member.memberId ?? member.id ?? "(saknas)"}
                    </div>
                  </div>
                  {member.isOwner && <Badge variant="owner">Owner</Badge>}
                </button>
              );
            })}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ marginTop: "16px" }}>
          <div style={{ marginBottom: "10px", color: "var(--muted)" }}>
            {selectedMember ? (
              <>
                Vald medlem: <strong>{selectedMember.email}</strong>
              </>
            ) : (
              "Välj en medlem i listan."
            )}
          </div>

          <label style={{ display: "block", marginBottom: "8px" }}>
            Lösenord
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!selectedMember || submitting}
            placeholder={selectedMember ? "Ange lösenord" : "Välj medlem först"}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid var(--surface2)",
              background: "var(--surface1)",
              color: "var(--text)",
              marginBottom: "12px",
            }}
          />

          <button
            type="submit"
            disabled={!selectedMember || submitting}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "6px",
              border: "none",
              background: "var(--primary)",
              color: "white",
              cursor: !selectedMember || submitting ? "not-allowed" : "pointer",
              opacity: !selectedMember || submitting ? 0.6 : 1,
            }}>
            {submitting ? "Loggar in..." : "Logga in"}
          </button>
        </form>
      </Card>
    </Page>
  );
}
