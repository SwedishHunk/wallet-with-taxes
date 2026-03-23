import { useCallback, useEffect, useMemo, useState } from "react";
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
import { readDevToolsTargets, writeDevToolsTargets } from "../lib/devtoolsTargets";
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

function toDisplayName(email?: string | null) {
  if (!email) return "Unknown";
  const localPart = email.split("@")[0] ?? email;
  return localPart
    .replace(/[.+_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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
  const [expandedStudios, setExpandedStudios] = useState<Record<string, boolean>>({});
  const [targetsState, setTargetsState] = useState(() => readDevToolsTargets());

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
    return `${toDisplayName(storedState.targetEmail)}${roleLabel}`;
  }, [isAdminSession, storedState]);

  const controlledStudioId = authContext.studioSession?.studioId ?? null;
  const controlledStudioName = authContext.studioSession?.studioName ?? null;
  const controlledMemberId = authContext.memberSession?.memberId ?? null;
  const controlledMemberEmail = authContext.memberSession?.email ?? null;
  const controlledRole = authContext.memberSession?.isOwner
    ? "owner"
    : storedState?.targetRole ?? "member";
  const targetedStudio = studios.find((studio) => studio.id === targetsState.studioId) ?? null;
  const targetedMember =
    targetedStudio?.members.find((member) => member.id === targetsState.memberId) ?? null;

  const loadTargets = useCallback(() => {
    if (!canShow) return Promise.resolve();

    let cancelled = false;
    setLoading(true);
    setError("");

    const request = devGetSessionTargets(returnToken)
      .then(({ data }) => {
        if (cancelled) return;
        setStudios(data.studios);
        setExpandedStudios((current) => {
          const next = { ...current };
          for (const studio of data.studios) {
            if (!(studio.id in next)) {
              next[studio.id] = controlledStudioId === studio.id;
            }
          }
          return next;
        });

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

    return request.finally(() => {
      cancelled = true;
    });
  }, [canShow, controlledStudioId, returnToken, storedState]);

  useEffect(() => {
    const syncTargets = () => {
      setTargetsState(readDevToolsTargets());
    };

    window.addEventListener("devtools:targets:change", syncTargets);
    return () => {
      window.removeEventListener("devtools:targets:change", syncTargets);
    };
  }, []);

  useEffect(() => {
    void loadTargets();
  }, [loadTargets]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadTargets();
    };

    window.addEventListener("devtools:admin:refresh", handleRefresh);
    return () => {
      window.removeEventListener("devtools:admin:refresh", handleRefresh);
    };
  }, [loadTargets]);

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

  const toggleExpanded = (studioId: string) => {
    setExpandedStudios((current) => ({
      ...current,
      [studioId]: !current[studioId],
    }));
  };

  const handleTargetStudio = (studioId: string) => {
    const currentTargets = readDevToolsTargets();
    const nextStudioId = currentTargets.studioId === studioId ? undefined : studioId;
    const nextState = {
      studioId: nextStudioId,
      memberId: undefined,
      gameId: nextStudioId === currentTargets.studioId ? currentTargets.gameId : undefined,
    };
    writeDevToolsTargets(nextState);
    setTargetsState(nextState);
  };

  const handleTargetMember = (studioId: string, memberId: string) => {
    const currentTargets = readDevToolsTargets();
    const sameTarget =
      currentTargets.studioId === studioId && currentTargets.memberId === memberId;
    const nextState = {
      studioId: sameTarget ? undefined : studioId,
      memberId: sameTarget ? undefined : memberId,
      gameId: sameTarget ? currentTargets.gameId : undefined,
    };
    writeDevToolsTargets(nextState);
    setTargetsState(nextState);
  };

  if (!canShow || typeof document === "undefined") {
    return null;
  }

  const railContent = (
    <Card className="session-switcher-panel">
      <div className="session-switcher-eyebrow">Session Switcher</div>
      <h3 className="session-switcher-title">{activeLabel}</h3>
      <p className="session-switcher-copy">
        `Target` keeps you in admin. `Enter` switches your actual session.
      </p>

      <div className="session-switcher-summary-grid">
        {controlledStudioName ? (
          <div className="session-switcher-current">
            <div className="session-switcher-current-label">Current session</div>
            <div className="session-switcher-current-title">{controlledStudioName}</div>
            <div className="session-switcher-current-meta">
              {isAdminSession
                ? "Admin control plane"
                : controlledMemberEmail
                  ? `${toDisplayName(controlledMemberEmail)} as ${controlledRole}`
                  : `Studio session as ${controlledRole}`}
            </div>
          </div>
        ) : null}

        <div className="session-switcher-current session-switcher-target-summary-card">
          <div className="session-switcher-current-label">Current target</div>
          <div className="session-switcher-current-title">
            {targetedStudio ? targetedStudio.name : "No target selected"}
          </div>
          <div className="session-switcher-current-meta">
            {targetedMember
              ? `${toDisplayName(targetedMember.email)} (${targetedMember.role})`
              : targetedStudio
                ? "Studio-level target"
                : "Choose Target on a studio or member below"}
          </div>
        </div>
      </div>

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
        {studios.map((studio) => {
          const primaryTarget =
            studio.members.find((member) => member.isOwner) ?? studio.members[0] ?? null;
          const isExpanded = expandedStudios[studio.id] ?? false;
          const nonOwnerMembers = studio.members.filter((member) => !member.isOwner);

          return (
          <section
            key={studio.id}
            className={`session-switcher-group${
              controlledStudioId === studio.id ? " session-switcher-group-current" : ""
            }${studio.status === "suspended" ? " session-switcher-group-suspended" : ""}`}
          >
            <div className="session-switcher-group-header">
              <div>
                <div className="session-switcher-group-title-row">
                  <button
                    type="button"
                    className="session-switcher-group-toggle"
                    onClick={() => toggleExpanded(studio.id)}
                  >
                    <span>{isExpanded ? "▼" : "▶"}</span>
                    <span className="session-switcher-group-title">{studio.name}</span>
                  </button>
                  {controlledStudioId === studio.id ? (
                    <span className="session-switcher-badge session-switcher-badge-current">
                      Current
                    </span>
                  ) : null}
                  {targetsState.studioId === studio.id && !targetsState.memberId ? (
                    <span className="session-switcher-badge session-switcher-badge-target">
                      Targeted
                    </span>
                  ) : null}
                  {studio.status === "suspended" ? (
                    <span className="session-switcher-badge session-switcher-badge-suspended">
                      Suspended
                    </span>
                  ) : null}
                </div>
                <div className="session-switcher-group-subtitle">
                  Studio status: {studio.status}
                </div>
              </div>
              <div className="session-switcher-group-actions">
                <button
                  type="button"
                  className={`session-switcher-action-btn${
                    targetsState.studioId === studio.id && !targetsState.memberId
                      ? " session-switcher-action-btn-active"
                      : ""
                  }`}
                  onClick={() => handleTargetStudio(studio.id)}
                  disabled={studio.status === "suspended"}
                >
                  {targetsState.studioId === studio.id && !targetsState.memberId
                    ? "Targeted"
                    : "Target"}
                </button>
                <button
                  type="button"
                  className="session-switcher-action-btn"
                  onClick={() => handleSwitch(studio.id, primaryTarget?.id)}
                  disabled={
                    actionKey === `switch:${studio.id}:${primaryTarget?.id ?? "none"}` ||
                    studio.status === "suspended" ||
                    !primaryTarget
                  }
                >
                  {actionKey === `switch:${studio.id}:${primaryTarget?.id ?? "none"}`
                    ? "Entering..."
                    : studio.status === "suspended"
                      ? "Suspended"
                      : primaryTarget
                        ? "Enter"
                        : "No member"}
                </button>
              </div>
            </div>

            {isExpanded ? (
            <div className="session-switcher-targets">
              {nonOwnerMembers.length ? (
                nonOwnerMembers.map((member) => (
                  <div
                    key={member.id}
                    className={`session-switcher-target-row${
                      controlledStudioId === studio.id && controlledMemberId === member.id
                        ? " session-switcher-target-row-current"
                        : ""
                    }`}
                  >
                    <div className="session-switcher-target-summary">
                      <div className="session-switcher-target-email">
                        {toDisplayName(member.email)}
                      </div>
                      <div className="session-switcher-target-meta">
                        {toDisplayName(member.email)}
                        {" · "}
                        {member.role}
                        {member.permissions.length
                          ? ` · ${member.permissions.length} permission${member.permissions.length === 1 ? "" : "s"}`
                          : " · no extra permissions"}
                      </div>
                      <div className="session-switcher-target-badges">
                        {controlledStudioId === studio.id && controlledMemberId === member.id ? (
                          <span className="session-switcher-target-current-label">
                            Current
                          </span>
                        ) : null}
                        {targetsState.studioId === studio.id &&
                        targetsState.memberId === member.id ? (
                          <span className="session-switcher-target-target-label">
                            Targeted
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="session-switcher-target-actions">
                      <button
                        type="button"
                        className={`session-switcher-action-btn${
                          targetsState.studioId === studio.id &&
                          targetsState.memberId === member.id
                            ? " session-switcher-action-btn-active"
                            : ""
                        }`}
                        onClick={() => handleTargetMember(studio.id, member.id)}
                        disabled={studio.status === "suspended"}
                      >
                        {targetsState.studioId === studio.id &&
                        targetsState.memberId === member.id
                          ? "Targeted"
                          : "Target"}
                      </button>
                      <button
                        type="button"
                        className="session-switcher-action-btn"
                        onClick={() => handleSwitch(studio.id, member.id)}
                        disabled={Boolean(actionKey) || studio.status === "suspended"}
                      >
                        Enter
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="session-switcher-target-empty">No extra members in this studio yet.</div>
              )}
            </div>
            ) : null}
          </section>
          );
        })}
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
