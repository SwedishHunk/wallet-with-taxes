import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Card, Button } from "../components/ui";
import { useAuthState } from "../lib/AuthContext";
import {
  devSeedMembers,
  devClearSeedMembers,
  devSeedGames,
  devClearSeedGames,
} from "../lib/devtools";
import "./DevToolsRail.css";

type RailConfig = {
  title: string;
  description: string;
  content: React.ReactNode;
};

function MembersTools({ studioId }: { studioId: string }) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const refresh = () => {
    window.dispatchEvent(new CustomEvent("devtools:members:refresh"));
  };

  const handleSeed = async (count: number) => {
    try {
      setActionLoading(`seed:${count}`);
      setError("");
      const { data } = await devSeedMembers({ studioId, count });
      setMessage(`Created ${data.count} test members`);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not seed test members",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleClear = async () => {
    const confirmed = window.confirm(
      "Remove all seeded test members from this studio?",
    );
    if (!confirmed) return;

    try {
      setActionLoading("clear");
      setError("");
      const { data } = await devClearSeedMembers({ studioId });
      setMessage(`Removed ${data.removed} test members`);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not clear seeded members",
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <div className="dev-tools-actions">
        {[5, 10, 25].map((count) => (
          <Button
            key={count}
            variant="secondary"
            onClick={() => handleSeed(count)}
            disabled={actionLoading === `seed:${count}`}
          >
            {actionLoading === `seed:${count}` ? `Seeding ${count}...` : `Seed ${count}`}
          </Button>
        ))}
        <Button
          variant="danger"
          onClick={handleClear}
          disabled={actionLoading === "clear"}
        >
          {actionLoading === "clear" ? "Clearing..." : "Clear seeded"}
        </Button>
      </div>
      {message ? <p className="dev-tools-message dev-tools-message-success">{message}</p> : null}
      {error ? <p className="dev-tools-message dev-tools-message-error">{error}</p> : null}
    </>
  );
}

function GamesTools({ studioId }: { studioId: string }) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const refresh = () => {
    window.dispatchEvent(new CustomEvent("devtools:games:refresh"));
  };

  const handleSeed = async (count: number) => {
    try {
      setActionLoading(`seed:${count}`);
      setError("");
      const { data } = await devSeedGames({ studioId, count });
      setMessage(`Created ${data.count} test games`);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not seed test games",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleClear = async () => {
    const confirmed = window.confirm(
      "Remove all seeded test games from this studio?",
    );
    if (!confirmed) return;

    try {
      setActionLoading("clear");
      setError("");
      const { data } = await devClearSeedGames({ studioId });
      setMessage(`Removed ${data.removed} test games`);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not clear seeded games",
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <div className="dev-tools-actions">
        {[1, 5, 10].map((count) => (
          <Button
            key={count}
            variant="secondary"
            onClick={() => handleSeed(count)}
            disabled={actionLoading === `seed:${count}`}
          >
            {actionLoading === `seed:${count}` ? `Seeding ${count}...` : `Seed ${count}`}
          </Button>
        ))}
        <Button
          variant="danger"
          onClick={handleClear}
          disabled={actionLoading === "clear"}
        >
          {actionLoading === "clear" ? "Clearing..." : "Clear seeded"}
        </Button>
      </div>
      {message ? <p className="dev-tools-message dev-tools-message-success">{message}</p> : null}
      {error ? <p className="dev-tools-message dev-tools-message-error">{error}</p> : null}
    </>
  );
}

function EmptyTools() {
  return (
    <p className="dev-tools-message">
      No page-specific tools yet. This rail is now global, so we can add the right
      operations per page instead of scattering ad hoc controls in the UI.
    </p>
  );
}

export function DevToolsRail() {
  const location = useLocation();
  const { authContext } = useAuthState();
  const studioSession = authContext.studioSession;
  const [showDrawer, setShowDrawer] = useState(false);

  const config = useMemo<RailConfig | null>(() => {
    if (!import.meta.env.DEV || !studioSession) return null;

    if (location.pathname === "/members") {
      return {
        title: "Dev Tools",
        description: "Stress-test member management with disposable accounts and permissions.",
        content: <MembersTools studioId={studioSession.studioId} />,
      };
    }

    if (location.pathname === "/games") {
      return {
        title: "Dev Tools",
        description: "Stress-test game management with seeded games in the current studio.",
        content: <GamesTools studioId={studioSession.studioId} />,
      };
    }

    if (authContext.state === "Studio+MemberActive" || authContext.state === "StudioAuthenticated") {
      return {
        title: "Dev Tools",
        description: "Page-aware local testing tools live here.",
        content: <EmptyTools />,
      };
    }

    return null;
  }, [authContext.state, location.pathname, studioSession]);

  if (!config || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        className="dev-tools-toggle"
        onClick={() => setShowDrawer((current) => !current)}
      >
        {showDrawer ? "Hide Dev Tools" : "Show Dev Tools"}
      </button>

      <aside className="dev-tools-rail" aria-label="Dev tools">
        <Card className="dev-tools-panel">
          <div className="dev-tools-eyebrow">{config.title}</div>
          <h3 className="dev-tools-title">Local testing only</h3>
          <p className="dev-tools-copy">{config.description}</p>
          {config.content}
        </Card>
      </aside>

      {showDrawer ? (
        <div className="dev-tools-overlay" onClick={() => setShowDrawer(false)}>
          <aside
            className="dev-tools-drawer"
            onClick={(event) => event.stopPropagation()}
            aria-label="Dev tools"
          >
            <Card className="dev-tools-panel">
              <div className="dev-tools-eyebrow">{config.title}</div>
              <h3 className="dev-tools-title">Local testing only</h3>
              <p className="dev-tools-copy">{config.description}</p>
              {config.content}
            </Card>
          </aside>
        </div>
      ) : null}
    </>,
    document.body,
  );
}
