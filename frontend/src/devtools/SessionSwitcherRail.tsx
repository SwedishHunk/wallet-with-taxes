import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, Button } from "../components/ui";
import { useAuthState } from "../lib/AuthContext";
import {
  devGetSessionTargets,
  devRestoreSession,
  devSwitchSession,
  SessionSwitchStudio,
} from "../lib/devtools";
import { ROUTES } from "../routes";
import "./SessionSwitcherRail.css";

type StoredImpersonationState = {
  returnToken: string;
  targetEmail?: string;
  targetStudioName?: string;
  targetRole?: string;
};

const STORAGE_KEY = "dev_impersonation_state";

function readStoredState(): StoredImpersonationState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.returnToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredState(state: StoredImpersonationState | null) {
  if (!state) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function SessionSwitcherRail() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    authContext,
    setStudioSession,
    setMemberSession,
    setActiveGame,
  } = useAuthState();
  const [storedState, setStoredState] = useState<StoredImpersonationState | null>(
    () => readStoredState(),
  );
  const [studios, setStudios] = useState<SessionSwitchStudio[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);

  const isAdminSession = authContext.studioSession?.isTriolithAdmin === true;
  const returnToken = storedState?.returnToken;
  const canShow = import.meta.env.DEV && (isAdminSession || Boolean(returnToken));

  const activeLabel = useMemo(() => {
    if (isAdminSession) {
      return "Triolith Admin";
    }

    if (!storedState?.targetEmail) {
      return "Impersonating";
    }

    const roleLabel = storedState.targetRole
      ? ` · ${storedState.targetRole}`
      : "";
    return `${storedState.targetEmail}${roleLabel}`;
  }, [isAdminSession, storedState]);

  useEffect(() => {
    if (!canShow) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    void devGetSessionTargets(returnToken)
      .then(({ data }) => {
        if (cancelled) return;
        setStudios(data.studios);

        if (!storedState && data.returnToken) {
          const nextState = { returnToken: data.returnToken };
          setStoredState(nextState);
          writeStoredState(nextState);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || "Could not load session switcher targets",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canShow, returnToken, storedState]);

  useEffect(() => {
    if (!canShow) {
      setShowDrawer(false);
    }
  }, [canShow]);

  const applySession = (response: {
    studio: { studioId: string; studioName: string; isTriolithAdmin: boolean };
    member: {
      memberId: string;
      userId: string;
      studioId: string;
      email: string;
      isOwner: boolean;
      permissions: string[];
      gameAccessIds: string[];
      authenticatedAt: string;
    };
  }) => {
    setStudioSession({
      ...response.studio,
      authenticatedAt: new Date().toISOString(),
    });
    setMemberSession(response.member);
    setActiveGame(null);
  };

  const handleSwitch = async (studioId: string, memberId?: string) => {
    try {
      const actionId = `switch:${studioId}:${memberId ?? "owner"}`;
      setActionKey(actionId);
      setError("");
      const { data } = await devSwitchSession({ studioId, memberId }, returnToken);
      applySession(data);

      const nextState: StoredImpersonationState = {
        returnToken: data.returnToken,
        targetEmail: data.impersonation.targetEmail,
        targetStudioName: data.impersonation.targetStudioName,
        targetRole: data.impersonation.targetRole,
      };

      setStoredState(nextState);
      writeStoredState(nextState);
      setShowDrawer(false);

      if (location.pathname === ROUTES.triolithAdmin) {
        navigate(ROUTES.dashboard);
      }
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not switch session",
      );
    } finally {
      setActionKey(null);
    }
  };

  const handleRestore = async () => {
    if (!returnToken) return;

    try {
      setActionKey("restore");
      setError("");
      const { data } = await devRestoreSession(returnToken);
      applySession(data);
      setStoredState(null);
      writeStoredState(null);
      setShowDrawer(false);
      navigate(ROUTES.triolithAdmin);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not restore admin session",
      );
    } finally {
      setActionKey(null);
    }
  };

  if (!canShow || typeof document === "undefined") {
    return null;
  }

  const railContent = (
    <Card className="session-switcher-panel">
      <div className="session-switcher-eyebrow">Session Switcher</div>
      <h3 className="session-switcher-title">{activeLabel}</h3>
      <p className="session-switcher-copy">
        Switch into a real studio/member session, then jump back to admin
        without logging in again.
      </p>

      {!isAdminSession && returnToken ? (
        <Button
          variant="primary"
          onClick={handleRestore}
          disabled={actionKey === "restore"}
        >
          {actionKey === "restore" ? "Returning..." : "Return to Admin"}
        </Button>
      ) : null}

      {loading ? (
        <p className="session-switcher-message">Loading targets...</p>
      ) : null}

      {error ? (
        <p className="session-switcher-message session-switcher-message-error">
          {error}
        </p>
      ) : null}

      <div className="session-switcher-groups">
        {studios.map((studio) => (
          <section key={studio.id} className="session-switcher-group">
            <div className="session-switcher-group-header">
              <div>
                <div className="session-switcher-group-title">{studio.name}</div>
                <div className="session-switcher-group-subtitle">
                  {studio.status}
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => handleSwitch(studio.id)}
                disabled={actionKey === `switch:${studio.id}:owner`}
              >
                {actionKey === `switch:${studio.id}:owner`
                  ? "Switching..."
                  : "As owner"}
              </Button>
            </div>

            <div className="session-switcher-targets">
              {studio.members
                .filter((member) => !member.isOwner)
                .map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="session-switcher-target"
                    onClick={() => handleSwitch(studio.id, member.id)}
                    disabled={Boolean(actionKey)}
                  >
                    <span className="session-switcher-target-email">
                      {member.email}
                    </span>
                    <span className="session-switcher-target-meta">
                      {member.role}
                      {member.permissions.length
                        ? ` · ${member.permissions.join(", ")}`
                        : " · no extra permissions"}
                    </span>
                  </button>
                ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  );

  return createPortal(
    <>
      <button
        type="button"
        className="session-switcher-toggle"
        onClick={() => setShowDrawer((current) => !current)}
      >
        {showDrawer ? "Hide Sessions" : "Show Sessions"}
      </button>

      <aside className="session-switcher-rail" aria-label="Session switcher">
        {railContent}
      </aside>

      {showDrawer ? (
        <div
          className="session-switcher-overlay"
          onClick={() => setShowDrawer(false)}
        >
          <aside
            className="session-switcher-drawer"
            onClick={(event) => event.stopPropagation()}
            aria-label="Session switcher"
          >
            {railContent}
          </aside>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
