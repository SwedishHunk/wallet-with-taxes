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
  devSeedEconomics,
  devClearSeedEconomics,
  devSeedNftTemplates,
  devClearSeedNftTemplates,
  devSeedNftInstances,
  devClearSeedNftInstances,
  devSetValuation,
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

function DashboardTools({
  studioId,
  gameId,
  gameName,
}: {
  studioId: string;
  gameId?: string;
  gameName?: string;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = () => {
    window.dispatchEvent(new CustomEvent("devtools:dashboard:refresh"));
  };

  const handleSeedStudio = async (count: number) => {
    try {
      setActionLoading(`studio-seed:${count}`);
      setError("");
      const { data } = await devSeedEconomics({ studioId, count });
      setMessage(`Created ${data.count} studio economic events`);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not seed studio economic events",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleSeedGame = async (count: number) => {
    if (!gameId) return;

    try {
      setActionLoading(`game-seed:${count}`);
      setError("");
      const { data } = await devSeedEconomics({ studioId, gameId, count });
      setMessage(`Created ${data.count} events for ${gameName ?? "the active game"}`);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not seed game economic events",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearStudio = async () => {
    const confirmed = window.confirm(
      "Remove all seeded studio economic events?",
    );
    if (!confirmed) return;

    try {
      setActionLoading("studio-clear");
      setError("");
      const { data } = await devClearSeedEconomics({ studioId });
      setMessage(`Removed ${data.removed} studio economic events`);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not clear studio economic events",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearGame = async () => {
    if (!gameId) return;

    const confirmed = window.confirm(
      `Remove all seeded events for ${gameName ?? "the active game"}?`,
    );
    if (!confirmed) return;

    try {
      setActionLoading("game-clear");
      setError("");
      const { data } = await devClearSeedEconomics({ studioId, gameId });
      setMessage(`Removed ${data.removed} events for ${gameName ?? "the active game"}`);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not clear game economic events",
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <div className="dev-tools-section">
        <div className="dev-tools-section-title">Studio aggregate</div>
        <div className="dev-tools-actions">
          {[5, 10].map((count) => (
            <Button
              key={count}
              variant="secondary"
              onClick={() => handleSeedStudio(count)}
              disabled={actionLoading === `studio-seed:${count}`}
            >
              {actionLoading === `studio-seed:${count}`
                ? `Seeding ${count}...`
                : `Seed ${count}`}
            </Button>
          ))}
          <Button
            variant="danger"
            onClick={handleClearStudio}
            disabled={actionLoading === "studio-clear"}
          >
            {actionLoading === "studio-clear" ? "Clearing..." : "Clear studio"}
          </Button>
        </div>
      </div>

      <div className="dev-tools-section">
        <div className="dev-tools-section-title">
          Active game{gameName ? ` · ${gameName}` : ""}
        </div>
        <div className="dev-tools-actions">
          {[3, 6].map((count) => (
            <Button
              key={count}
              variant="secondary"
              onClick={() => handleSeedGame(count)}
              disabled={!gameId || actionLoading === `game-seed:${count}`}
            >
              {actionLoading === `game-seed:${count}`
                ? `Seeding ${count}...`
                : `Seed ${count}`}
            </Button>
          ))}
          <Button
            variant="danger"
            onClick={handleClearGame}
            disabled={!gameId || actionLoading === "game-clear"}
          >
            {actionLoading === "game-clear" ? "Clearing..." : "Clear game"}
          </Button>
        </div>
      </div>

      {message ? <p className="dev-tools-message dev-tools-message-success">{message}</p> : null}
      {error ? <p className="dev-tools-message dev-tools-message-error">{error}</p> : null}
    </>
  );
}

function NFTManagementTools({
  studioId,
  gameId,
}: {
  studioId: string;
  gameId: string;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = () => {
    window.dispatchEvent(new CustomEvent("devtools:nfts:refresh"));
  };

  const handleSeedTemplates = async (count: number) => {
    try {
      setActionLoading(`templates-seed:${count}`);
      setError("");
      const { data } = await devSeedNftTemplates({ studioId, gameId, count });
      setMessage(`Created ${data.count} seeded NFT templates`);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not seed NFT templates",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearTemplates = async () => {
    const confirmed = window.confirm(
      "Remove all seeded NFT templates and any instances minted from them?",
    );
    if (!confirmed) return;

    try {
      setActionLoading("templates-clear");
      setError("");
      const { data } = await devClearSeedNftTemplates({ studioId, gameId });
      setMessage(
        `Removed ${data.removedTemplates} templates and ${data.removedInstances} linked instances`,
      );
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not clear seeded NFT templates",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleSeedInstances = async (count: number) => {
    try {
      setActionLoading(`instances-seed:${count}`);
      setError("");
      const { data } = await devSeedNftInstances({ studioId, gameId, count });
      setMessage(
        `Minted ${data.count} seeded NFTs across ${data.playerCount} game players`,
      );
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not mint seeded NFTs",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearInstances = async () => {
    const confirmed = window.confirm(
      "Remove all seeded minted NFTs for this game?",
    );
    if (!confirmed) return;

    try {
      setActionLoading("instances-clear");
      setError("");
      const { data } = await devClearSeedNftInstances({ studioId, gameId });
      setMessage(`Removed ${data.removed} seeded minted NFTs`);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not clear seeded NFT instances",
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <div className="dev-tools-section">
        <div className="dev-tools-section-title">Templates</div>
        <div className="dev-tools-actions">
          {[2, 5].map((count) => (
            <Button
              key={count}
              variant="secondary"
              onClick={() => handleSeedTemplates(count)}
              disabled={actionLoading === `templates-seed:${count}`}
            >
              {actionLoading === `templates-seed:${count}`
                ? `Seeding ${count}...`
                : `Seed ${count}`}
            </Button>
          ))}
          <Button
            variant="danger"
            onClick={handleClearTemplates}
            disabled={actionLoading === "templates-clear"}
          >
            {actionLoading === "templates-clear" ? "Clearing..." : "Clear templates"}
          </Button>
        </div>
      </div>

      <div className="dev-tools-section">
        <div className="dev-tools-section-title">Minted NFTs</div>
        <div className="dev-tools-actions">
          {[3, 6].map((count) => (
            <Button
              key={count}
              variant="secondary"
              onClick={() => handleSeedInstances(count)}
              disabled={actionLoading === `instances-seed:${count}`}
            >
              {actionLoading === `instances-seed:${count}`
                ? `Minting ${count}...`
                : `Mint ${count}`}
            </Button>
          ))}
          <Button
            variant="danger"
            onClick={handleClearInstances}
            disabled={actionLoading === "instances-clear"}
          >
            {actionLoading === "instances-clear" ? "Clearing..." : "Clear minted"}
          </Button>
        </div>
      </div>

      {message ? <p className="dev-tools-message dev-tools-message-success">{message}</p> : null}
      {error ? <p className="dev-tools-message dev-tools-message-error">{error}</p> : null}
    </>
  );
}

function SettingsTools() {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = () => {
    window.dispatchEvent(new CustomEvent("devtools:settings:refresh"));
  };

  const handlePreset = async (
    actionKey: string,
    payload: { ethUsd?: number; usdSek?: number },
    messageText: string,
  ) => {
    try {
      setActionLoading(actionKey);
      setError("");
      await devSetValuation(payload);
      setMessage(messageText);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not update valuation snapshot",
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <div className="dev-tools-section">
        <div className="dev-tools-section-title">Valuation presets</div>
        <div className="dev-tools-actions">
          <Button
            variant="secondary"
            onClick={() =>
              handlePreset("preset:base", { ethUsd: 3200, usdSek: 10.5 }, "Loaded base valuation preset")
            }
            disabled={actionLoading === "preset:base"}
          >
            {actionLoading === "preset:base" ? "Applying..." : "Base preset"}
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              handlePreset("preset:bull", { ethUsd: 4500, usdSek: 11.2 }, "Loaded higher market preset")
            }
            disabled={actionLoading === "preset:bull"}
          >
            {actionLoading === "preset:bull" ? "Applying..." : "Higher market"}
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              handlePreset("preset:bear", { ethUsd: 1800, usdSek: 9.8 }, "Loaded lower market preset")
            }
            disabled={actionLoading === "preset:bear"}
          >
            {actionLoading === "preset:bear" ? "Applying..." : "Lower market"}
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              handlePreset("preset:clear", { ethUsd: 0, usdSek: 0 }, "Cleared runtime valuation snapshot")
            }
            disabled={actionLoading === "preset:clear"}
          >
            {actionLoading === "preset:clear" ? "Clearing..." : "Clear runtime"}
          </Button>
        </div>
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
  const { authContext, activeGame } = useAuthState();
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

    if (location.pathname === "/dashboard") {
      return {
        title: "Dev Tools",
        description:
          "Seed and clear economic events so the dashboard panels show fresh, attributable tracking data.",
        content: (
          <DashboardTools
            studioId={studioSession.studioId}
            gameId={activeGame?.gameId}
            gameName={activeGame?.name}
          />
        ),
      };
    }

    if (location.pathname.startsWith("/games/") && location.pathname.endsWith("/nfts")) {
      const gameId = location.pathname.split("/")[2];
      if (!gameId) {
        return null;
      }

      return {
        title: "Dev Tools",
        description:
          "Create and clear seeded NFT templates and minted inventory without mixing the controls into the product UI.",
        content: (
          <NFTManagementTools
            studioId={studioSession.studioId}
            gameId={gameId}
          />
        ),
      };
    }

    if (location.pathname === "/settings") {
      return {
        title: "Dev Tools",
        description:
          "Swap valuation snapshots quickly so we can test settings, portfolio and tax-facing UI against fresh runtime inputs.",
        content: <SettingsTools />,
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
  }, [activeGame?.gameId, activeGame?.name, authContext.state, location.pathname, studioSession]);

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
