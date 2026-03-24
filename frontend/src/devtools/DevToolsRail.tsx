import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Card, Button } from "../components/ui";
import { useAuthState } from "../lib/AuthContext";
import { api } from "../lib/api";
import {
  devSeedStudios,
  devClearSeedStudios,
  devSeedMembers,
  devClearSeedMembers,
  devSeedGames,
  devClearSeedGames,
  devSeedPlayers,
  devClearSeedPlayers,
  devSeedEconomics,
  devClearSeedEconomics,
  devSeedNftTemplates,
  devClearSeedNftTemplates,
  devSeedNftInstances,
  devClearSeedNftInstances,
  devSetValuation,
} from "../lib/devtools";
import { readDevToolsTargets, writeDevToolsTargets } from "../lib/devtoolsTargets";
import "./DevToolsRail.css";

type RailConfig = {
  title: string;
  description: string;
  content: React.ReactNode;
};

type AdminStudioOption = {
  id: string;
  name: string;
  status: string;
};

type AdminGameOption = {
  id: string;
  name: string;
  slug: string;
  status: string;
  studioId: string | null;
};

function dispatchDevtoolsRefreshBurst(eventNames: string[]) {
  const uniqueEvents = [...new Set(eventNames)];
  const delays = [0, 180, 500];

  for (const delay of delays) {
    window.setTimeout(() => {
      for (const eventName of uniqueEvents) {
        window.dispatchEvent(new CustomEvent(eventName));
      }
    }, delay);
  }
}

function DevToolsSection({
  title,
  help,
  children,
}: {
  title: string;
  help?: string;
  children: React.ReactNode;
}) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="dev-tools-section">
      <div className="dev-tools-section-header">
        <div className="dev-tools-section-title">{title}</div>
        {help ? (
          <button
            type="button"
            className="dev-tools-section-help"
            onClick={() => setShowHelp((current) => !current)}
            aria-label={`Toggle help for ${title}`}
            aria-expanded={showHelp}
          >
            ?
          </button>
        ) : null}
      </div>
      {help && showHelp ? <div className="dev-tools-info">{help}</div> : null}
      {children}
    </div>
  );
}

function DevToolsStage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dev-tools-stage">
      <div className="dev-tools-stage-header">
        <div className="dev-tools-stage-title">{title}</div>
        <div className="dev-tools-stage-subtitle">{subtitle}</div>
      </div>
      <div className="dev-tools-stage-content">{children}</div>
    </section>
  );
}

function MembersTools({ studioId }: { studioId: string }) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const refresh = () => {
    dispatchDevtoolsRefreshBurst(["devtools:members:refresh", "devtools:admin:refresh"]);
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
          className="dev-tools-action-clear"
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
    dispatchDevtoolsRefreshBurst(["devtools:games:refresh", "devtools:admin:refresh"]);
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
          className="dev-tools-action-clear"
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

function AdminStudiosTools() {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = () => {
    dispatchDevtoolsRefreshBurst(["devtools:admin:refresh"]);
  };

  const handleSeed = async (count: number) => {
    try {
      setActionLoading(`seed:${count}`);
      setError("");
      const { data } = await devSeedStudios({ count });
      setMessage(`Created ${data.count} seeded studio${data.count === 1 ? "" : "s"}`);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not seed studios",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleClear = async () => {
    const confirmed = window.confirm("Remove all seeded studios and their seeded owners/games?");
    if (!confirmed) return;

    try {
      setActionLoading("clear");
      setError("");
      const { data } = await devClearSeedStudios();
      setMessage(`Removed ${data.removedStudios} seeded studios and ${data.removedUsers} seeded users`);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not clear seeded studios",
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <DevToolsSection
      title="Studios"
      help="Creates fresh studios with seeded owners so the admin overview has real studio data to inspect and manage."
    >
      <div className="dev-tools-actions">
        {[1, 5].map((count) => (
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
          className="dev-tools-action-clear"
          onClick={handleClear}
          disabled={actionLoading === "clear"}
        >
          {actionLoading === "clear" ? "Clearing..." : "Clear seeded"}
        </Button>
      </div>
      {message ? <p className="dev-tools-message dev-tools-message-success">{message}</p> : null}
      {error ? <p className="dev-tools-message dev-tools-message-error">{error}</p> : null}
    </DevToolsSection>
  );
}

function PlayersTools({ studioId, gameId, gameName }: { studioId: string; gameId: string; gameName?: string }) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = () => {
    dispatchDevtoolsRefreshBurst(["devtools:admin:refresh", "devtools:nfts:refresh"]);
  };

  const handleSeed = async (count: number) => {
    try {
      setActionLoading(`seed:${count}`);
      setError("");
      const { data } = await devSeedPlayers({ studioId, gameId, count });
      setMessage(`Created ${data.count} seeded players for ${gameName ?? "the selected game"}`);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not seed players",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleClear = async () => {
    const confirmed = window.confirm(`Remove all seeded players from ${gameName ?? "the selected game"}?`);
    if (!confirmed) return;

    try {
      setActionLoading("clear");
      setError("");
      const { data } = await devClearSeedPlayers({ studioId, gameId });
      setMessage(`Removed ${data.removedPlayers} seeded players and ${data.removedUsers} seeded users`);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not clear seeded players",
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <DevToolsSection
      title="Players in active game"
      help="Creates disposable players inside the selected game. Use this before NFT seeding or game-specific transactions when you need real players to attach data to."
    >
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
          className="dev-tools-action-clear"
          onClick={handleClear}
          disabled={actionLoading === "clear"}
        >
          {actionLoading === "clear" ? "Clearing..." : "Clear seeded"}
        </Button>
      </div>
      {message ? <p className="dev-tools-message dev-tools-message-success">{message}</p> : null}
      {error ? <p className="dev-tools-message dev-tools-message-error">{error}</p> : null}
    </DevToolsSection>
  );
}


function AdminToolsTargeted({
  defaultStudioId,
  defaultGameId,
}: {
  defaultStudioId: string;
  defaultGameId?: string;
}) {
  const [studios, setStudios] = useState<AdminStudioOption[]>([]);
  const [games, setGames] = useState<AdminGameOption[]>([]);
  const initialTargets = readDevToolsTargets();
  const [selectedStudioId, setSelectedStudioId] = useState(
    initialTargets.studioId ?? defaultStudioId,
  );
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    initialTargets.memberId ?? "",
  );
  const [selectedGameId, setSelectedGameId] = useState<string>(
    initialTargets.gameId ?? defaultGameId ?? "",
  );
  const [showTargetTools, setShowTargetTools] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    Promise.all([
      api.get<AdminStudioOption[]>("/admin/studios"),
      api.get<AdminGameOption[]>("/admin/games"),
    ])
      .then(([studioResponse, gameResponse]) => {
        if (cancelled) return;
        setStudios(studioResponse.data);
        setGames(gameResponse.data);

        const storedTargets = readDevToolsTargets();
        const preferredStudioId = storedTargets.studioId ?? defaultStudioId;
        const hasPreferredStudio = studioResponse.data.some((studio) => studio.id === preferredStudioId);
        const nextStudioId = hasPreferredStudio
          ? preferredStudioId
          : studioResponse.data.find((studio) => studio.status === "active")?.id ?? "";
        setSelectedStudioId(nextStudioId);

        const matchingGames = gameResponse.data.filter((game) => game.studioId === nextStudioId);
        const preferredGameId = storedTargets.gameId ?? defaultGameId;
        const hasPreferredGame = matchingGames.some((game) => game.id === preferredGameId);
        setSelectedGameId(hasPreferredGame ? preferredGameId ?? "" : matchingGames[0]?.id ?? "");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            "Could not load admin seed targets",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const refresh = () => {
      void Promise.all([
        api.get<AdminStudioOption[]>("/admin/studios"),
        api.get<AdminGameOption[]>("/admin/games"),
      ]).then(([studioResponse, gameResponse]) => {
        if (cancelled) return;
        setStudios(studioResponse.data);
        setGames(gameResponse.data);
      });
    };

    window.addEventListener("devtools:admin:refresh", refresh);
    const syncTargets = () => {
      const nextTargets = readDevToolsTargets();
      if (nextTargets.studioId) {
        setSelectedStudioId(nextTargets.studioId);
      }
      setSelectedMemberId(nextTargets.memberId ?? "");
      if (nextTargets.gameId !== undefined) {
        setSelectedGameId(nextTargets.gameId);
      }
    };
    window.addEventListener("devtools:targets:change", syncTargets);
    return () => {
      cancelled = true;
      window.removeEventListener("devtools:admin:refresh", refresh);
      window.removeEventListener("devtools:targets:change", syncTargets);
    };
  }, [defaultGameId, defaultStudioId]);

  useEffect(() => {
    if (!selectedStudioId) {
      setSelectedGameId("");
      return;
    }

    const studioGames = games.filter((game) => game.studioId === selectedStudioId);
    if (!studioGames.some((game) => game.id === selectedGameId)) {
      setSelectedGameId(studioGames[0]?.id ?? "");
    }
  }, [games, selectedGameId, selectedStudioId]);

  useEffect(() => {
    writeDevToolsTargets({
      studioId: selectedStudioId || undefined,
      memberId: selectedMemberId || undefined,
      gameId: selectedGameId || undefined,
    });
  }, [selectedGameId, selectedMemberId, selectedStudioId]);

  const selectedGame = games.find((game) => game.id === selectedGameId);

  return (
    <>
      <DevToolsStage
        title="1. Studio"
        subtitle="Create studios first, then work against the studio you have target-selected in Session Switcher."
      >
        <DevToolsSection
          title="Current studio"
          help="Studio and member targeting live in Session Switcher on the left. This section only reflects what is currently targeted."
        >
          {selectedStudioId ? (
            <div className="dev-tools-message dev-tools-message-success">
              Targeting studio {studios.find((studio) => studio.id === selectedStudioId)?.name ?? "selected studio"}
              {selectedMemberId ? " with a specific member target" : ""}.
            </div>
          ) : (
            <p className="dev-tools-message">
              Set a target studio in Session Switcher first.
            </p>
          )}
          {loading ? <p className="dev-tools-message">Loading targets...</p> : null}
          {error ? <p className="dev-tools-message dev-tools-message-error">{error}</p> : null}
        </DevToolsSection>

        <AdminStudiosTools />

        {selectedStudioId ? (
          <DevToolsSection
            title="Members"
            help="Creates temporary members inside the targeted studio so the admin overview has real people, permissions, and session targets to inspect."
          >
            <MembersTools studioId={selectedStudioId} />
          </DevToolsSection>
        ) : null}

        {selectedStudioId ? (
          <DevToolsSection
            title="Games"
            help="Creates temporary games inside the targeted studio so the admin overview can drill into real game structures without leaving admin."
          >
            <GamesTools studioId={selectedStudioId} />
          </DevToolsSection>
        ) : null}
      </DevToolsStage>

      <DevToolsStage
        title="2. Game"
        subtitle="Choose which game inside the targeted studio the next tools should work on."
      >
        <DevToolsSection
          title="Current game"
          help="This only sets the game target for admin-side tools. It does not switch your actual session."
        >
          {selectedStudioId ? (
            <>
              {selectedGame ? (
                <div className="dev-tools-message dev-tools-message-success">
                  Target game: <strong>{selectedGame.name}</strong>
                </div>
              ) : (
                <p className="dev-tools-message">No target game selected yet.</p>
              )}
              <div className="dev-tools-actions">
                <Button
                  variant="secondary"
                  className="dev-tools-action-inline"
                  onClick={() => setShowTargetTools((current) => !current)}
                >
                  {showTargetTools ? "Hide game picker" : "Set target game"}
                </Button>
              </div>
              {showTargetTools ? (
                <div className="dev-tools-fieldset">
                  <label className="dev-tools-field">
                    <span>Target game</span>
                    <select
                      value={selectedGameId}
                      onChange={(event) => setSelectedGameId(event.target.value)}
                      className="dev-tools-select"
                      disabled={games.every((game) => game.studioId !== selectedStudioId)}
                    >
                      <option value="">No game selected</option>
                      {games
                        .filter((game) => game.studioId === selectedStudioId)
                        .map((game) => (
                          <option key={game.id} value={game.id}>
                            {game.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              ) : null}
            </>
          ) : (
            <p className="dev-tools-message">
              Choose a target studio first.
            </p>
          )}
        </DevToolsSection>
      </DevToolsStage>

      <DevToolsStage
        title="3. Game Data"
        subtitle="Once a game is targeted, create players, transactions, and NFTs for that game."
      >
        {selectedStudioId && selectedGameId ? (
          <>
            <PlayersTools studioId={selectedStudioId} gameId={selectedGameId} gameName={selectedGame?.name} />
            <DashboardTools studioId={selectedStudioId} gameId={selectedGameId} gameName={selectedGame?.name} />
            <NFTManagementTools studioId={selectedStudioId} gameId={selectedGameId} />
          </>
        ) : (
          <DevToolsSection title="Game data unavailable">
            <div className="dev-tools-info">
              Pick a target studio and a target game above before seeding players, transactions, or NFTs.
            </div>
          </DevToolsSection>
        )}
      </DevToolsStage>
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
    dispatchDevtoolsRefreshBurst(["devtools:dashboard:refresh", "devtools:admin:refresh"]);
  };

  const handleSeedStudio = async (count: number) => {
    try {
      setActionLoading(`studio-seed:${count}`);
      setError("");
      const { data } = await devSeedEconomics({
        studioId,
        excludeGameId: gameId,
        count,
      });
      setMessage(
        `Created ${data.count} events across ${data.targetGameCount} other studio game${data.targetGameCount === 1 ? "" : "s"}`,
      );
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not seed whole-studio events",
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
      const { data } = await devClearSeedEconomics({
        studioId,
        excludeGameId: gameId,
      });
      setMessage(`Removed ${data.removed} whole-studio seeded events`);
      refresh();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Could not clear whole-studio events",
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
      <DevToolsSection
        title="Other studio games"
        help="Creates real game events in the other games that belong to this studio. Use this to check that the studio-wide panel grows while the selected game's panel stays focused on the game you are working in now."
      >
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
            className="dev-tools-action-clear"
            onClick={handleClearStudio}
            disabled={actionLoading === "studio-clear"}
          >
            {actionLoading === "studio-clear" ? "Clearing..." : "Clear studio"}
          </Button>
        </div>
      </DevToolsSection>

      <DevToolsSection
        title={`Selected game${gameName ? ` · ${gameName}` : ""}`}
        help="Creates real game events in the game you currently have selected. Use this to check that the game-specific panel reacts to this game only."
      >
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
            className="dev-tools-action-clear"
            onClick={handleClearGame}
            disabled={!gameId || actionLoading === "game-clear"}
          >
            {actionLoading === "game-clear" ? "Clearing..." : "Clear game"}
          </Button>
        </div>
      </DevToolsSection>

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
    dispatchDevtoolsRefreshBurst(["devtools:nfts:refresh", "devtools:admin:refresh"]);
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
      <DevToolsSection
        title="Templates"
        help="Creates temporary NFT templates so we can test template creation, tier display, mint limits, and basic NFT inventory setup without filling everything in by hand."
      >
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
            className="dev-tools-action-clear"
            onClick={handleClearTemplates}
            disabled={actionLoading === "templates-clear"}
          >
            {actionLoading === "templates-clear" ? "Clearing..." : "Clear templates"}
          </Button>
        </div>
      </DevToolsSection>

      <DevToolsSection
        title="Minted NFTs"
        help="Mints temporary NFTs into existing players in this game so we can check ownership, minted inventory, and readiness for later flows like the marketplace."
      >
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
            className="dev-tools-action-clear"
            onClick={handleClearInstances}
            disabled={actionLoading === "instances-clear"}
          >
            {actionLoading === "instances-clear" ? "Clearing..." : "Clear minted"}
          </Button>
        </div>
      </DevToolsSection>

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
    dispatchDevtoolsRefreshBurst(["devtools:settings:refresh"]);
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
      <DevToolsSection
        title="Valuation presets"
        help="Loads quick price presets so we can see whether settings, portfolio, and tax-facing views react correctly when valuation numbers change."
      >
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
            className="dev-tools-action-clear"
            onClick={() =>
              handlePreset("preset:clear", { ethUsd: 0, usdSek: 0 }, "Cleared runtime valuation snapshot")
            }
            disabled={actionLoading === "preset:clear"}
          >
            {actionLoading === "preset:clear" ? "Clearing..." : "Clear runtime"}
          </Button>
        </div>
      </DevToolsSection>

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

function DashboardSetupTools() {
  return (
    <div className="dev-tools-info">
      Choose an active game first. The dashboard only shows player and studio
      economic panels when a game is selected, so the seed/clear event tools
      stay hidden until this page can actually display the result.
    </div>
  );
}

export function DevToolsRail() {
  const location = useLocation();
  const { authContext, activeGame } = useAuthState();
  const studioSession = authContext.studioSession;
  const [showDrawer, setShowDrawer] = useState(false);
  const config = useMemo<RailConfig | null>(() => {
    if (!import.meta.env.DEV || !studioSession) return null;

    if (location.pathname === "/triolith-admin") {
      return {
        title: "Dev Tools",
        description:
          "Create fresh studios, games, players, transactions, and NFTs so the admin control plane has real material to inspect.",
        content: (
          <AdminToolsTargeted
            defaultStudioId={studioSession.studioId}
            defaultGameId={activeGame?.gameId}
          />
        ),
      };
    }

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
      if (!activeGame?.gameId) {
        return {
          title: "Dev Tools",
          description:
            "This page needs an active game before the dashboard can show economic tracking data.",
          content: <DashboardSetupTools />,
        };
      }

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
          <div className="dev-tools-header">
            <div className="dev-tools-eyebrow">{config.title}</div>
          </div>
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
              <div className="dev-tools-header">
                <div className="dev-tools-eyebrow">{config.title}</div>
              </div>
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
