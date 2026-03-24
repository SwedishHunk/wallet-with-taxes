import { Fragment, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { api } from "../../lib/api";
import { Page, PageHeader, Card } from "../../components/ui/index";
import { useCountUp } from "../../hooks/useCountUp";
import {
  devClearSandboxData,
  devFullLocalReset,
  devGetSystemState,
  type DevSystemStateResponse,
} from "../../lib/devtools";
import { getDevtoolsMode, setDevtoolsMode, type DevtoolsMode } from "../../lib/devtoolsMode";
import { devBootstrap } from "../../lib/users";
import { useAuthState } from "../../lib/AuthContext";
import { writeDevToolsTargets } from "../../lib/devtoolsTargets";

gsap.registerPlugin(ScrollTrigger);

type FeeStats = {
  totalFeesUSD: number;
  totalTrades: number;
};

type RevenueSplit = {
  totalFeesUSD: number;
  devShareUSD: number;
  triolithNetUSD: number;
  safuShareUSD: number;
  stakerShareUSD: number;
};

type StudioRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  memberCount: number;
  createdAt: string;
};

type StudioPlayerRow = {
  id: string;
  gameId: string | null;
  gameName: string | null;
  userId: string | null;
  email: string | null;
  walletAddress: string | null;
  joinedAt: string;
  level: number;
  exp: number;
  source: string;
};

type StudioMemberRow = {
  id: string;
  userId: string;
  email: string;
  isOwner: boolean;
  role: string;
  permissions: string;
  createdAt: string;
};

type AdminEconomicEventRow = {
  id: string;
  eventType: string;
  source: string;
  direction: "in" | "out" | "neutral";
  amount: string;
  assetKey: string;
  walletAddress: string | null;
  gameId: string | null;
  timestamp: string;
  metadata?: Record<string, unknown> | null;
};

type TransactionRow = {
  id: number;
  type: "BUY" | "SELL";
  userAddress: string;
  assetAddress: string;
  assetSymbol: string;
  amountIn: string;
  amountOut: string;
  blockNumber: number;
  txHash: string | null;
  timestamp: string;
};

type UserRow = {
  id: string;
  email: string;
  walletAddress: string;
  custodyMode: string;
  kycStatus: string;
  isAdmin: boolean;
  isSuspended: boolean;
  createdAt: string;
};

type GameRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  studioId: string | null;
  studioName: string | null;
  createdAt: string;
};

type AuditEntry = {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

type TransactionsResponse = {
  events: TransactionRow[];
  total: number;
  limit: number;
  offset: number;
};

type AuditResponse = {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
};

type StudioEcoRow = {
  studioId: string;
  eventCount: number;
  totalIn: number;
  totalOut: number;
  lastSeen: string | null;
};

const btnStyle = (variant: "danger" | "success" | "neutral"): React.CSSProperties => ({
  padding: "0.3rem 0.7rem",
  fontSize: "0.75rem",
  borderRadius: "8px",
  border: "1px solid transparent",
  cursor: "pointer",
  fontWeight: 600,
  transition: "transform 0.15s, box-shadow 0.15s",
  background:
    variant === "danger"
      ? "rgba(239, 68, 68, 0.15)"
      : variant === "success"
        ? "rgba(34, 197, 94, 0.15)"
        : "rgba(255, 255, 255, 0.06)",
  color:
    variant === "danger"
      ? "#ef4444"
      : variant === "success"
        ? "#22c55e"
        : "var(--text)",
  borderColor:
    variant === "danger"
      ? "rgba(239, 68, 68, 0.3)"
      : variant === "success"
        ? "rgba(34, 197, 94, 0.3)"
        : "rgba(255, 255, 255, 0.1)",
});

/* ─── Animated Stat Card ──────────────────────────────────── */

function StatValue({
  value,
  prefix = "",
  suffix = "",
  decimals = 2,
}: {
  value: number | null;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const { display } = useCountUp({
    target: value ?? 0,
    prefix,
    suffix,
    decimals,
    duration: 1.8,
    delay: 0.3,
  });

  if (value === null) {
    return (
      <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
        —
      </span>
    );
  }

  return (
    <span style={{ fontWeight: 700, fontSize: "1.3rem", fontVariantNumeric: "tabular-nums" }}>
      {display}
    </span>
  );
}

const detailCardStyle: React.CSSProperties = {
  padding: "0.9rem 1rem",
  borderRadius: "14px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
};

function formatCompactAmount(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function DetailSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      style={{
        ...detailCardStyle,
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          fontWeight: 700,
        }}
      >
        <span>{title}</span>
        {typeof count === "number" ? (
          <span
            style={{
              color: "var(--text-muted)",
              fontSize: "0.75rem",
              fontWeight: 600,
              padding: "0.18rem 0.5rem",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {count}
          </span>
        ) : null}
      </summary>
      <div style={{ marginTop: "0.85rem" }}>{children}</div>
    </details>
  );
}

function StudioGameTree({
  games,
  players,
  transactions,
  onToggleStatus,
  onDelete,
}: {
  games: GameRow[] | undefined;
  players: StudioPlayerRow[] | undefined;
  transactions: AdminEconomicEventRow[] | undefined;
  onToggleStatus?: (game: GameRow) => void;
  onDelete?: (game: GameRow) => void;
}) {
  if (games === undefined) {
    return <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Loading games...</span>;
  }

  if (games.length === 0) {
    return <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No games for this studio.</span>;
  }

  const playersByGame = (players ?? []).reduce<Record<string, StudioPlayerRow[]>>((acc, player) => {
    const key = player.gameId ?? "__ungrouped__";
    acc[key] = [...(acc[key] ?? []), player];
    return acc;
  }, {});

  const transactionsByGame = (transactions ?? []).reduce<Record<string, AdminEconomicEventRow[]>>((acc, tx) => {
    const key = tx.gameId ?? "__studio__";
    acc[key] = [...(acc[key] ?? []), tx];
    return acc;
  }, {});

  return (
    <div style={{ display: "grid", gap: "0.7rem" }}>
      {games.map((game, index) => {
        const gamePlayers = playersByGame[game.id] ?? [];
        const gameTransactions = transactionsByGame[game.id] ?? [];

        return (
          <details
            key={game.id}
            open={index === 0}
            style={{
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(7, 13, 27, 0.45)",
              padding: "0.8rem 0.9rem",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                listStyle: "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{game.name}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                  {game.slug} · {game.status}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.4rem",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "flex-end",
                }}
              >
                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                  {gamePlayers.length} players
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                  {gameTransactions.length} transactions
                </span>
                {onToggleStatus && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleStatus(game); }}
                    style={btnStyle(game.status === "active" ? "danger" : "success")}
                  >
                    {game.status === "active" ? "Suspend" : "Activate"}
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(game); }}
                    style={btnStyle("danger")}
                  >
                    Delete
                  </button>
                )}
              </div>
            </summary>

            <div style={{ display: "grid", gap: "0.7rem", marginTop: "0.8rem" }}>
              <DetailSection title="Players" count={gamePlayers.length}>
                {players === undefined ? (
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Loading players...</span>
                ) : gamePlayers.length === 0 ? (
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No players in this game yet.</span>
                ) : (
                  <div style={{ display: "grid", gap: "0.45rem" }}>
                    {gamePlayers.map((player) => (
                      <div
                        key={player.id}
                        style={{
                          padding: "0.55rem 0.7rem",
                          borderRadius: "10px",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {player.email ?? player.walletAddress ?? "Unknown player"}
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: "0.76rem" }}>
                          Level {player.level} · XP {player.exp} · {new Date(player.joinedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>

              <DetailSection title="Transactions" count={gameTransactions.length}>
                {transactions === undefined ? (
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Loading transactions...</span>
                ) : gameTransactions.length === 0 ? (
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No transactions for this game yet.</span>
                ) : (
                  <div style={{ display: "grid", gap: "0.45rem" }}>
                    {gameTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        style={{
                          padding: "0.55rem 0.7rem",
                          borderRadius: "10px",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                          <strong>{tx.eventType}</strong>
                          <span
                            style={{
                              color:
                                tx.direction === "in"
                                  ? "var(--success, #22c55e)"
                                  : tx.direction === "out"
                                    ? "var(--danger, #ef4444)"
                                    : "var(--text-muted)",
                              fontWeight: 700,
                            }}
                          >
                            {tx.direction === "out" ? "-" : tx.direction === "in" ? "+" : ""}
                            {formatCompactAmount(tx.amount)} {tx.assetKey.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: "0.76rem" }}>
                          {new Date(tx.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>
            </div>
          </details>
        );
      })}

      {(transactionsByGame.__studio__ ?? []).length > 0 ? (
        <DetailSection title="Studio-level transactions" count={transactionsByGame.__studio__.length}>
          <div style={{ display: "grid", gap: "0.45rem" }}>
            {transactionsByGame.__studio__.map((tx) => (
              <div
                key={tx.id}
                style={{
                  padding: "0.55rem 0.7rem",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                  <strong>{tx.eventType}</strong>
                  <span>{formatCompactAmount(tx.amount)} {tx.assetKey.toUpperCase()}</span>
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.76rem" }}>
                  {new Date(tx.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </DetailSection>
      ) : null}
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────── */

export default function TriolithAdminPage() {
  const { setStudioSession, setMemberSession, setActiveGame } = useAuthState();
  const [fees, setFees] = useState<FeeStats | null>(null);
  const [revenue, setRevenue] = useState<RevenueSplit | null>(null);
  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [studioEco, setStudioEco] = useState<StudioEcoRow[]>([]);
  const [txOffset, setTxOffset] = useState(0);
  const [platformFee, setPlatformFee] = useState<number | null>(null);
  const [feeInput, setFeeInput] = useState("");
  const [feeMsg, setFeeMsg] = useState("");
  const [studioSearch, setStudioSearch] = useState("");
  const [studioStatusFilter, setStudioStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [studioSort, setStudioSort] = useState<"newest" | "oldest" | "name">("newest");
  const [expandedStudioId, setExpandedStudioId] = useState<string | null>(null);
  const [studioGames, setStudioGames] = useState<Record<string, GameRow[]>>({});
  const [studioMembers, setStudioMembers] = useState<Record<string, StudioMemberRow[]>>({});
  const [studioPlayers, setStudioPlayers] = useState<Record<string, StudioPlayerRow[]>>({});
  const [studioTransactions, setStudioTransactions] = useState<Record<string, AdminEconomicEventRow[]>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [devtoolsMode, setDevtoolsModeState] = useState<DevtoolsMode>(() => getDevtoolsMode());
  const [systemState, setSystemState] = useState<DevSystemStateResponse | null>(null);
  const [devActionMessage, setDevActionMessage] = useState("");
  const [devActionLoading, setDevActionLoading] = useState<string | null>(null);
  const TX_LIMIT = 25;
  const visibleUsers = users;

  const filteredStudios = [...studios]
    .filter((studio) => {
      if (studioStatusFilter !== "all" && studio.status !== studioStatusFilter) {
        return false;
      }

      const q = studioSearch.trim().toLowerCase();
      if (!q) return true;

      return (
        studio.name.toLowerCase().includes(q) ||
        studio.email.toLowerCase().includes(q)
      );
    })
    .sort((left, right) => {
      if (studioSort === "name") {
        return left.name.localeCompare(right.name);
      }

      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      return studioSort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });

  // Refs for GSAP animations
  const statsRowRef = useRef<HTMLDivElement>(null);
  const studiosRef = useRef<HTMLDivElement>(null);
  const ecoRef = useRef<HTMLDivElement>(null);
  const txRef = useRef<HTMLDivElement>(null);
  const usersRef = useRef<HTMLDivElement>(null);
  const auditRef = useRef<HTMLDivElement>(null);

  const loadSystemState = () => {
    void devGetSystemState()
      .then((r) => setSystemState(r.data))
      .catch(handleError);
  };

  const fetchAuditLog = () => {
    void api
      .get<AuditResponse>("/admin/audit-log?limit=25")
      .then((r) => setAuditEntries(r.data.entries))
      .catch(() => {});
  };

  const loadStudioDetails = (studioId: string) => {
    const fetchDetails = () => {
      void api
        .get<GameRow[]>(`/admin/studios/${studioId}/games`)
        .then((r) => setStudioGames((prev) => ({ ...prev, [studioId]: r.data })))
        .catch(handleError);
      void api
        .get<StudioMemberRow[]>(`/admin/studios/${studioId}/members`)
        .then((r) =>
          setStudioMembers((prev) => ({
            ...prev,
            [studioId]: r.data.filter((member) => !member.email.includes("dev-admin@triolith.local")),
          })),
        )
        .catch(handleError);
      void api
        .get<StudioPlayerRow[]>(`/admin/studios/${studioId}/players`)
        .then((r) => setStudioPlayers((prev) => ({ ...prev, [studioId]: r.data })))
        .catch(handleError);
      void api
        .get<AdminEconomicEventRow[]>(`/admin/studios/${studioId}/transactions?limit=12`)
        .then((r) => setStudioTransactions((prev) => ({ ...prev, [studioId]: r.data })))
        .catch(handleError);
    };

    fetchDetails();
    window.setTimeout(fetchDetails, 250);
  };

  useEffect(() => {
    void api.get<FeeStats>("/admin/fees").then((r) => setFees(r.data));
    void api.get<RevenueSplit>("/admin/revenue").then((r) => setRevenue(r.data));
    void api.get<StudioRow[]>("/admin/studios").then((r) => setStudios(r.data));
    void api.get<UserRow[]>("/admin/users").then((r) => setUsers(r.data));
    void api.get<StudioEcoRow[]>("/admin/economics/studios").then((r) => setStudioEco(r.data));
    fetchAuditLog();
    loadSystemState();
    void api
      .get<{ feePercent: number }>("/admin/platform/fee")
      .then((r) => {
        setPlatformFee(r.data.feePercent);
        setFeeInput(String(r.data.feePercent));
      });
  }, []);

  useEffect(() => {
    const handleAdminRefresh = () => {
      refreshAdminCollections();
    };

    window.addEventListener("devtools:admin:refresh", handleAdminRefresh);
    return () => {
      window.removeEventListener("devtools:admin:refresh", handleAdminRefresh);
    };
  }, []);

  useEffect(() => {
    const fetchTx = () => {
      void api
        .get<TransactionsResponse>(
          `/admin/transactions?limit=${TX_LIMIT}&offset=${txOffset}`,
        )
        .then((r) => {
          setTransactions(r.data.events);
          setTxTotal(r.data.total);
        });
    };

    fetchTx();

    // Retry after 2 s to catch sync-in-progress race condition.
    const retry = setTimeout(fetchTx, 2000);

    // Auto-refresh every 15 s.
    const interval = setInterval(fetchTx, 15_000);

    // Refresh when the tab becomes visible again.
    function onVisible() {
      if (document.visibilityState === "visible") fetchTx();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(retry);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [txOffset]);

  // GSAP entrance: stats row (stagger children)
  useEffect(() => {
    if (!statsRowRef.current) return;
    const children = statsRowRef.current.children;
    gsap.fromTo(
      children,
      { y: 30, opacity: 0, scale: 0.95 },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.6,
        stagger: 0.12,
        delay: 0.2,
        ease: "power3.out",
      },
    );
  }, []);

  // GSAP ScrollTrigger for table sections
  useEffect(() => {
    const sections = [studiosRef, ecoRef, txRef, usersRef, auditRef];
    const triggers: ScrollTrigger[] = [];

    sections.forEach((ref) => {
      const el = ref.current;
      if (!el) return;
      gsap.set(el, { opacity: 0, y: 25 });
      const trigger = ScrollTrigger.create({
        trigger: el,
        start: "top 88%",
        onEnter: () => {
          gsap.to(el, {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power3.out",
          });
        },
        once: true,
      });
      triggers.push(trigger);
    });

    return () => {
      triggers.forEach((t) => t.kill());
    };
  }, []);


  const handleError = (err: unknown) => {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message ??
      (err instanceof Error ? err.message : "Action failed");
    setActionError(msg);
    setTimeout(() => setActionError(null), 4000);
  };

  const handleModeChange = (mode: DevtoolsMode) => {
    setDevtoolsMode(mode);
    setDevtoolsModeState(mode);
    setDevActionMessage(
      mode === "sandbox"
        ? "Sandbox mode enabled"
        : "Live-like mode enabled",
    );
    setTimeout(() => setDevActionMessage(""), 2500);
  };

  const handleClearSandbox = () => {
    const confirmed = window.confirm(
      "Clear all seeded sandbox data across the local environment?",
    );
    if (!confirmed) return;

    setDevActionLoading("clear-sandbox");
    setDevActionMessage("");
    void devClearSandboxData()
      .then((r) => {
        setDevActionMessage(
          `Removed ${r.data.removedStudios ?? 0} studios, ${r.data.removedMembers} members, ${r.data.removedGames} games, ${r.data.removedEconomicEvents} economic events`,
        );
        refreshAdminCollections();
      })
      .catch(handleError)
      .finally(() => setDevActionLoading(null));
  };

  const refreshAdminCollections = () => {
    const fetchCollections = () =>
      Promise.all([
        api.get<StudioRow[]>("/admin/studios"),
        api.get<UserRow[]>("/admin/users"),
        api.get<StudioEcoRow[]>("/admin/economics/studios"),
      ])
        .then(([studiosResponse, usersResponse, ecoResponse]) => {
          setStudios(studiosResponse.data);
          setUsers(usersResponse.data);
          setStudioEco(ecoResponse.data);
        })
        .catch(handleError);

    loadSystemState();
    fetchAuditLog();
    void fetchCollections();
    window.setTimeout(() => {
      void fetchCollections();
    }, 250);
    setStudioGames({});
    setStudioMembers({});
    setStudioPlayers({});
    setStudioTransactions({});
    if (expandedStudioId) {
      window.setTimeout(() => {
        loadStudioDetails(expandedStudioId);
      }, 120);
    }
  };

  const handleFullReset = () => {
    const confirmed = window.confirm(
      "Run a full local reset? This clears local users, studios, games, transactions and test data, while keeping admin access intact.",
    );
    if (!confirmed) return;

    setDevActionLoading("full-reset");
    setDevActionMessage("");
    void devFullLocalReset("RESET LOCAL DEV DATA")
      .then(async () => {
        writeDevToolsTargets({});
        const bootstrap = await devBootstrap({ mode: "admin" });
        setStudioSession({
          ...bootstrap.data.studio,
          authenticatedAt: new Date().toISOString(),
        });
        setMemberSession(bootstrap.data.member);
        setActiveGame(bootstrap.data.game);
        setExpandedStudioId(null);
        setDevActionMessage("Local reset completed and admin was restored");
        refreshAdminCollections();
        window.dispatchEvent(new CustomEvent("devtools:admin:refresh"));
      })
      .catch(handleError)
      .finally(() => setDevActionLoading(null));
  };

  const toggleStudioStatus = (studio: StudioRow) => {
    const next = studio.status === "active" ? "suspended" : "active";
    void api
      .patch<{ id: string; status: string }>(`/admin/studios/${studio.id}/status`, { status: next })
      .then(() => { setStudios((prev) => prev.map((s) => (s.id === studio.id ? { ...s, status: next } : s))); fetchAuditLog(); })
      .catch(handleError);
  };

  const deleteStudio = (studio: StudioRow) => {
    if (!window.confirm(`Delete studio "${studio.name}"? This cannot be undone.`)) return;
    void api
      .delete<{ id: string; deleted: boolean }>(`/admin/studios/${studio.id}`)
      .then(() => {
        setStudios((prev) => prev.filter((s) => s.id !== studio.id));
        setExpandedStudioId((current) => (current === studio.id ? null : current));
        refreshAdminCollections();
        fetchAuditLog();
      })
      .catch(handleError);
  };

  const deleteGame = (game: GameRow) => {
    if (!window.confirm(`Delete game "${game.name}"? This cannot be undone.`)) return;
    void api
      .delete<{ id: string; deleted: boolean }>(`/admin/games/${game.id}`)
      .then(() => {
        refreshAdminCollections();
        fetchAuditLog();
      })
      .catch(handleError);
  };

  const toggleStudioGames = (studioId: string) => {
    if (expandedStudioId === studioId) {
      setExpandedStudioId(null);
      return;
    }
    setExpandedStudioId(studioId);
    if (
      !studioGames[studioId] ||
      !studioMembers[studioId] ||
      !studioPlayers[studioId] ||
      !studioTransactions[studioId]
    ) {
      loadStudioDetails(studioId);
    }
  };

  const toggleUserAdmin = (user: UserRow) => {
    const next = !user.isAdmin;
    void api
      .patch<{ id: string; isAdmin: boolean }>(`/admin/users/${user.id}/admin`, { isAdmin: next })
      .then(() => { setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isAdmin: next } : u))); fetchAuditLog(); })
      .catch(handleError);
  };

  const toggleUserSuspended = (user: UserRow) => {
    const next = !user.isSuspended;
    void api
      .patch<{ id: string; isSuspended: boolean }>(`/admin/users/${user.id}/suspended`, { suspended: next })
      .then(() => { setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isSuspended: next } : u))); fetchAuditLog(); })
      .catch(handleError);
  };

  const deleteUser = (user: UserRow) => {
    if (!window.confirm(`Delete user "${user.email}"? This cannot be undone.`)) return;
    void api
      .delete<{ id: string; deleted: boolean }>(`/admin/users/${user.id}`)
      .then(() => { setUsers((prev) => prev.filter((u) => u.id !== user.id)); fetchAuditLog(); })
      .catch(handleError);
  };

  const toggleGameStatus = (game: GameRow) => {
    const next: "active" | "inactive" = game.status === "active" ? "inactive" : "active";
    void api
      .patch<{ id: string; status: string }>(`/admin/games/${game.id}/status`, { status: next })
      .then(() => {
        setStudioGames((prev) => {
          const updated: Record<string, GameRow[]> = {};
          for (const sid of Object.keys(prev)) {
            updated[sid] = prev[sid].map((g) => (g.id === game.id ? { ...g, status: next } : g));
          }
          return updated;
        });
        fetchAuditLog();
      })
      .catch(handleError);
  };

  const savePlatformFee = () => {
    const val = parseFloat(feeInput);
    if (isNaN(val) || val < 0 || val > 100) {
      setFeeMsg("Enter a value between 0 and 100");
      return;
    }
    void api
      .patch<{ feePercent: number }>("/admin/platform/fee", { feePercent: val })
      .then((r) => {
        setPlatformFee(r.data.feePercent);
        setFeeMsg("Saved");
        setTimeout(() => setFeeMsg(""), 2000);
        fetchAuditLog();
      })
      .catch(handleError);
  };

  /* ─── Table row hover helpers ─────────────────────────── */
  const rowHoverEnter = (e: React.MouseEvent<HTMLTableRowElement>) => {
    gsap.to(e.currentTarget, {
      backgroundColor: "rgba(255, 215, 0, 0.03)",
      duration: 0.2,
    });
  };
  const rowHoverLeave = (e: React.MouseEvent<HTMLTableRowElement>) => {
    gsap.to(e.currentTarget, {
      backgroundColor: "transparent",
      duration: 0.2,
    });
  };

  return (
    <Page>
      <PageHeader title="Triolith Admin" subtitle="Platform-wide overview" />

      {actionError && (
        <div style={{
          background: "rgba(239, 68, 68, 0.12)",
          color: "#ef4444",
          padding: "0.6rem 1rem",
          borderRadius: "10px",
          marginBottom: "1rem",
          fontSize: "0.875rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          backdropFilter: "blur(8px)",
        }}>
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            style={{
              background: "none",
              border: "none",
              color: "#ef4444",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "1rem",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Stats row with animated counters ── */}
      <div
        ref={statsRowRef}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <Card>
          <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
            Platform Fee Stats
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Total fees
              </span>
              <StatValue value={fees?.totalFeesUSD ?? null} prefix="$" />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Total trades
              </span>
              <StatValue
                value={fees?.totalTrades ?? null}
                decimals={0}
              />
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
            Revenue Split
          </h3>
          {revenue ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {[
                { label: "Dev share (60%)", value: revenue.devShareUSD },
                { label: "Triolith net (28.5%)", value: revenue.triolithNetUSD },
                { label: "SAFU cut (1.5%)", value: revenue.safuShareUSD },
                { label: "Staker share (10%)", value: revenue.stakerShareUSD },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    fontSize: "0.85rem",
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>{row.label}</span>
                  <StatValue value={row.value} prefix="$" />
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              Loading...
            </p>
          )}
        </Card>

        <Card>
          <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
            Platform Fee Rate
          </h3>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "0.8rem",
              marginBottom: "0.75rem",
            }}
          >
            Current:{" "}
            <strong>
              {platformFee !== null ? `${platformFee}%` : "..."}
            </strong>
          </p>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={feeInput}
              onChange={(e) => setFeeInput(e.target.value)}
              style={{
                width: "80px",
                padding: "0.3rem 0.5rem",
                fontSize: "0.875rem",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(255, 255, 255, 0.04)",
                color: "var(--text)",
              }}
            />
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              %
            </span>
            <button onClick={savePlatformFee} style={btnStyle("neutral")}>
              Save
            </button>
          </div>
          {feeMsg && (
            <p
              style={{
                marginTop: "0.4rem",
                fontSize: "0.8rem",
                color: "var(--success, #22c55e)",
              }}
            >
              {feeMsg}
            </p>
          )}
        </Card>
      </div>

      <Card style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ minWidth: "260px", flex: "1 1 320px" }}>
            <h3 style={{ marginBottom: "0.5rem", fontWeight: 600 }}>
              Reset & Sandbox
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              Central control plane for local reset behavior. Seeding lives in the Dev Tools rail
              so it stays separate from destructive environment controls.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <button
                onClick={() => handleModeChange("sandbox")}
                style={btnStyle(devtoolsMode === "sandbox" ? "success" : "neutral")}
              >
                Sandbox mode
              </button>
              <button
                onClick={() => handleModeChange("live-like")}
                style={btnStyle(devtoolsMode === "live-like" ? "neutral" : "neutral")}
              >
                Live-like mode
              </button>
              <button
                onClick={loadSystemState}
                style={btnStyle("neutral")}
              >
                Refresh state
              </button>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <button
                onClick={handleClearSandbox}
                style={btnStyle("danger")}
                disabled={devActionLoading === "clear-sandbox"}
              >
                {devActionLoading === "clear-sandbox" ? "Clearing..." : "Clear sandbox data"}
              </button>
            </div>

            <div
              style={{
                padding: "0.9rem",
                borderRadius: "12px",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                background: "rgba(239, 68, 68, 0.06)",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: "0.4rem" }}>Full local reset</div>
              <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: "0.6rem" }}>
                Deletes local platform data, clears users/studios/games/transactions,
                and keeps platform admin access intact.
              </p>
              <button
                onClick={handleFullReset}
                style={btnStyle("danger")}
                disabled={devActionLoading === "full-reset"}
              >
                {devActionLoading === "full-reset" ? "Resetting..." : "Run full local reset"}
              </button>
            </div>

            {devActionMessage ? (
              <p style={{ marginTop: "0.75rem", color: "#7ef7cf", fontSize: "0.85rem" }}>
                {devActionMessage}
              </p>
            ) : null}
          </div>

          <div style={{ minWidth: "260px", flex: "1 1 320px" }}>
            <h4 style={{ marginBottom: "0.5rem", fontWeight: 600 }}>Current local state</h4>
            {systemState ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div style={{ padding: "0.8rem", borderRadius: "12px", background: "rgba(255,255,255,0.04)" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Users</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{visibleUsers.length}</div>
                </div>
                <div style={{ padding: "0.8rem", borderRadius: "12px", background: "rgba(255,255,255,0.04)" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Studios</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{systemState.totals.studios}</div>
                </div>
                <div style={{ padding: "0.8rem", borderRadius: "12px", background: "rgba(255,255,255,0.04)" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Games</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{systemState.totals.games}</div>
                </div>
                <div style={{ padding: "0.8rem", borderRadius: "12px", background: "rgba(255,255,255,0.04)" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Members</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{systemState.totals.members}</div>
                </div>
                <div style={{ padding: "0.8rem", borderRadius: "12px", background: "rgba(255,255,255,0.04)" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Transactions</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{systemState.totals.transactions}</div>
                </div>
                <div style={{ padding: "0.8rem", borderRadius: "12px", background: "rgba(255,255,255,0.04)" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Economic events</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{systemState.totals.economicEvents}</div>
                </div>
                <div style={{ gridColumn: "1 / -1", padding: "0.8rem", borderRadius: "12px", background: "rgba(0, 212, 255, 0.06)", border: "1px solid rgba(0, 212, 255, 0.14)" }}>
                  <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>
                    Sandbox data
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                    {systemState.sandbox.studios ?? 0} seeded studios · {systemState.sandbox.members} seeded members · {systemState.sandbox.games} seeded games · {systemState.sandbox.economicEvents} seeded economic events
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Loading system state...
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ── Economics per Studio ── */}
      <div ref={ecoRef}>
        <Card style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
            Studio Economics Summary
          </h3>
          {studioEco.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No economic events logged yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Studio", "Events", "Total In", "Total Out", "Net", "Last Event"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.6rem", color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {studioEco.map((row) => {
                    const studioName = studios.find((s) => s.id === row.studioId)?.name ?? row.studioId.slice(0, 8) + "…";
                    const net = row.totalIn - row.totalOut;
                    return (
                      <tr key={row.studioId} style={{ borderBottom: "1px solid var(--border)" }} onMouseEnter={rowHoverEnter} onMouseLeave={rowHoverLeave}>
                        <td style={{ padding: "0.4rem 0.6rem", fontWeight: 600 }}>{studioName}</td>
                        <td style={{ padding: "0.4rem 0.6rem" }}>{row.eventCount}</td>
                        <td style={{ padding: "0.4rem 0.6rem", color: "var(--success, #22c55e)" }}>{row.totalIn.toFixed(2)}</td>
                        <td style={{ padding: "0.4rem 0.6rem", color: "var(--danger, #ef4444)" }}>{row.totalOut.toFixed(2)}</td>
                        <td style={{ padding: "0.4rem 0.6rem", fontWeight: 600, color: net >= 0 ? "var(--success, #22c55e)" : "var(--danger, #ef4444)" }}>{net >= 0 ? "+" : ""}{net.toFixed(2)}</td>
                        <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{row.lastSeen ? new Date(row.lastSeen).toLocaleDateString() : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Studios (scroll-triggered) ── */}
      <div ref={studiosRef}>
        <Card style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <div>
              <h3 style={{ marginBottom: "0.35rem", fontWeight: 600 }}>
                Studios ({filteredStudios.length})
              </h3>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.82rem" }}>
                Studios are the organizational hub. Expand to manage games, members, and players for each studio.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <input
                value={studioSearch}
                onChange={(e) => setStudioSearch(e.target.value)}
                placeholder="Search studios"
                style={{
                  minWidth: "180px",
                  padding: "0.35rem 0.6rem",
                  fontSize: "0.82rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "#0f1b31",
                  color: "var(--text)",
                  colorScheme: "dark",
                }}
              />
              <select
                value={studioStatusFilter}
                onChange={(e) => setStudioStatusFilter(e.target.value as "all" | "active" | "suspended")}
                style={{
                  padding: "0.35rem 0.6rem",
                  fontSize: "0.82rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "#0f1b31",
                  color: "var(--text)",
                  colorScheme: "dark",
                }}
              >
                <option value="all" style={{ background: "#0f1b31", color: "#f3f7ff" }}>All statuses</option>
                <option value="active" style={{ background: "#0f1b31", color: "#f3f7ff" }}>Active</option>
                <option value="suspended" style={{ background: "#0f1b31", color: "#f3f7ff" }}>Suspended</option>
              </select>
              <select
                value={studioSort}
                onChange={(e) => setStudioSort(e.target.value as "newest" | "oldest" | "name")}
                style={{
                  padding: "0.35rem 0.6rem",
                  fontSize: "0.82rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "#0f1b31",
                  color: "var(--text)",
                  colorScheme: "dark",
                }}
              >
                <option value="newest" style={{ background: "#0f1b31", color: "#f3f7ff" }}>Newest first</option>
                <option value="oldest" style={{ background: "#0f1b31", color: "#f3f7ff" }}>Oldest first</option>
                <option value="name" style={{ background: "#0f1b31", color: "#f3f7ff" }}>A-Z</option>
              </select>
            </div>
          </div>
          {filteredStudios.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No studios match the current filters.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Name", "Email", "Members", "Status", "Created", "Actions"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "0.4rem 0.6rem",
                          color: "var(--text-muted)",
                          fontWeight: 500,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudios.map((s) => (
                    <Fragment key={s.id}>
                      <tr
                        style={{ borderBottom: "1px solid var(--border)", transition: "background 0.2s" }}
                        onMouseEnter={rowHoverEnter}
                        onMouseLeave={rowHoverLeave}
                      >
                        <td style={{ padding: "0.4rem 0.6rem", fontWeight: 600 }}>
                          <button
                            onClick={() => toggleStudioGames(s.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontWeight: 600,
                              padding: 0,
                              color: "var(--text)",
                              transition: "color 0.15s",
                            }}
                          >
                            {expandedStudioId === s.id ? "▼" : "▶"} {s.name}
                          </button>
                        </td>
                        <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)" }}>
                          {s.email}
                        </td>
                        <td style={{ padding: "0.4rem 0.6rem" }}>{s.memberCount}</td>
                        <td style={{ padding: "0.4rem 0.6rem" }}>
                          <span
                            style={{
                              color: s.status === "active" ? "var(--success, #22c55e)" : "var(--danger, #ef4444)",
                              fontWeight: 500,
                            }}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)" }}>
                          {new Date(s.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "0.4rem 0.6rem" }}>
                          <div style={{ display: "flex", gap: "0.35rem" }}>
                            <button
                              onClick={() => toggleStudioStatus(s)}
                              style={btnStyle(s.status === "active" ? "danger" : "success")}
                            >
                              {s.status === "active" ? "Suspend" : "Reactivate"}
                            </button>
                            <button onClick={() => deleteStudio(s)} style={btnStyle("danger")}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedStudioId === s.id && (
                        <tr style={{ background: "rgba(255, 255, 255, 0.02)" }}>
                          <td colSpan={6} style={{ padding: "0.5rem 1.5rem 0.75rem" }}>
                            <div style={{ display: "grid", gap: "0.85rem" }}>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                                  gap: "0.6rem",
                                }}
                              >
                                {[
                                  {
                                    label: "Games",
                                    value: studioGames[s.id]?.length,
                                  },
                                  {
                                    label: "Members",
                                    value: studioMembers[s.id]?.length,
                                  },
                                  {
                                    label: "Players",
                                    value: studioPlayers[s.id]?.length,
                                  },
                                  {
                                    label: "Transactions",
                                    value: studioTransactions[s.id]?.length,
                                  },
                                ].map((item) => (
                                  <div
                                    key={item.label}
                                    style={{
                                      padding: "0.75rem 0.85rem",
                                      borderRadius: "12px",
                                      background: "rgba(255,255,255,0.035)",
                                      border: "1px solid rgba(255,255,255,0.08)",
                                    }}
                                  >
                                    <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
                                      {item.label}
                                    </div>
                                    <div style={{ fontWeight: 800, fontSize: "1rem", marginTop: "0.15rem" }}>
                                      {item.value ?? "…"}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <DetailSection title="Members" count={studioMembers[s.id]?.length} defaultOpen>
                                {studioMembers[s.id] === undefined ? (
                                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Loading members...</span>
                                ) : studioMembers[s.id].length === 0 ? (
                                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No members in this studio.</span>
                                ) : (
                                  <div style={{ display: "grid", gap: "0.45rem" }}>
                                    {studioMembers[s.id].map((member) => (
                                      <div
                                        key={member.id}
                                        style={{
                                          padding: "0.6rem 0.75rem",
                                          borderRadius: "10px",
                                          background: "rgba(255,255,255,0.03)",
                                          border: "1px solid rgba(255,255,255,0.06)",
                                          display: "flex",
                                          justifyContent: "space-between",
                                          gap: "0.75rem",
                                          flexWrap: "wrap",
                                        }}
                                      >
                                        <div>
                                          <div style={{ fontWeight: 600 }}>{member.email}</div>
                                          <div style={{ color: "var(--text-muted)", fontSize: "0.76rem" }}>
                                            {member.isOwner ? "owner" : member.role}
                                          </div>
                                        </div>
                                        <div style={{ color: "var(--text-muted)", fontSize: "0.76rem" }}>
                                          {member.permissions || "No extra permissions"}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </DetailSection>

                              <DetailSection title="Games" count={studioGames[s.id]?.length}>
                                <StudioGameTree
                                  games={studioGames[s.id]}
                                  players={studioPlayers[s.id]}
                                  transactions={studioTransactions[s.id]}
                                  onToggleStatus={toggleGameStatus}
                                  onDelete={deleteGame}
                                />
                              </DetailSection>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Transactions (scroll-triggered) ── */}
      <div ref={txRef}>
        <Card style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h3 style={{ fontWeight: 600 }}>
              All Transactions ({txTotal} total)
            </h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                disabled={txOffset === 0}
                onClick={() => setTxOffset(Math.max(0, txOffset - TX_LIMIT))}
                style={{
                  padding: "0.25rem 0.75rem",
                  fontSize: "0.8rem",
                  cursor: txOffset === 0 ? "not-allowed" : "pointer",
                  opacity: txOffset === 0 ? 0.4 : 1,
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "rgba(255, 255, 255, 0.04)",
                  color: "var(--text)",
                }}
              >
                Prev
              </button>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", alignSelf: "center" }}>
                {txOffset + 1}–{Math.min(txOffset + TX_LIMIT, txTotal)} of{" "}
                {txTotal}
              </span>
              <button
                disabled={txOffset + TX_LIMIT >= txTotal}
                onClick={() => setTxOffset(txOffset + TX_LIMIT)}
                style={{
                  padding: "0.25rem 0.75rem",
                  fontSize: "0.8rem",
                  cursor: txOffset + TX_LIMIT >= txTotal ? "not-allowed" : "pointer",
                  opacity: txOffset + TX_LIMIT >= txTotal ? 0.4 : 1,
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "rgba(255, 255, 255, 0.04)",
                  color: "var(--text)",
                }}
              >
                Next
              </button>
            </div>
          </div>
          {transactions.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No transactions yet.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Type", "User Address", "Asset", "Amount In", "Amount Out", "Block", "Tx Hash", "Time"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "0.4rem 0.6rem",
                          color: "var(--text-muted)",
                          fontWeight: 500,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      style={{ borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={rowHoverEnter}
                      onMouseLeave={rowHoverLeave}
                    >
                      <td style={{ padding: "0.4rem 0.6rem", fontWeight: 700, color: tx.type === "BUY" ? "var(--success)" : "var(--danger)" }}>
                        {tx.type}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {tx.userAddress ? tx.userAddress.slice(0, 10) + "..." : "—"}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {tx.assetSymbol || (tx.assetAddress ? tx.assetAddress.slice(0, 10) + "..." : "—")}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", fontWeight: 600 }}>
                        {tx.amountIn}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", fontWeight: 600, color: tx.type === "BUY" ? "var(--success)" : "var(--danger)" }}>
                        {tx.amountOut}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)" }}>
                        {tx.blockNumber}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {tx.txHash ? tx.txHash.slice(0, 10) + "..." : "—"}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Platform Accounts (scroll-triggered) ── */}
      <div ref={usersRef}>
        <Card style={{ marginBottom: "1.5rem" }}>
          <div style={{ marginBottom: "0.75rem" }}>
            <h3 style={{ marginBottom: "0.25rem", fontWeight: 600 }}>
              Platform Accounts ({visibleUsers.length})
            </h3>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.82rem" }}>
              All registered login accounts — platform-level controls only (KYC, admin flag, suspend).
              Studio owners also appear in their studio&apos;s member list above.
            </p>
          </div>
          {visibleUsers.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No users yet.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Email", "Wallet", "Custody", "KYC", "Admin", "Status", "Created", "Actions"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "0.4rem 0.6rem",
                          color: "var(--text-muted)",
                          fontWeight: 500,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((u) => (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        opacity: u.isSuspended ? 0.6 : 1,
                      }}
                      onMouseEnter={rowHoverEnter}
                      onMouseLeave={rowHoverLeave}
                    >
                      <td style={{ padding: "0.4rem 0.6rem", fontWeight: 500 }}>
                        {u.email}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {u.walletAddress ? u.walletAddress.slice(0, 10) + "..." : "—"}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem" }}>{u.custodyMode}</td>
                      <td style={{ padding: "0.4rem 0.6rem" }}>
                        <span
                          style={{
                            color: u.kycStatus === "verified" ? "var(--success, #22c55e)" : "var(--text-muted)",
                          }}
                        >
                          {u.kycStatus}
                        </span>
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem" }}>
                        <span
                          style={{
                            color: u.isAdmin ? "var(--success, #22c55e)" : "var(--text-muted)",
                          }}
                        >
                          {u.isAdmin ? "Admin" : "—"}
                        </span>
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem" }}>
                        <span
                          style={{
                            color: u.isSuspended ? "var(--danger, #ef4444)" : "var(--success, #22c55e)",
                            fontWeight: 500,
                          }}
                        >
                          {u.isSuspended ? "suspended" : "active"}
                        </span>
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)" }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem" }}>
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          <button
                            onClick={() => toggleUserAdmin(u)}
                            style={btnStyle(u.isAdmin ? "danger" : "neutral")}
                            title={u.isAdmin ? "Revoke admin" : "Grant admin"}
                          >
                            {u.isAdmin ? "Revoke Admin" : "Make Admin"}
                          </button>
                          <button
                            onClick={() => toggleUserSuspended(u)}
                            style={btnStyle(u.isSuspended ? "success" : "danger")}
                          >
                            {u.isSuspended ? "Unsuspend" : "Suspend"}
                          </button>
                          <button
                            onClick={() => deleteUser(u)}
                            style={btnStyle("danger")}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Audit Log (scroll-triggered) ── */}
      <div ref={auditRef}>
        <Card>
          <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
            Audit Log (last 25)
          </h3>
          {auditEntries.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No audit entries yet.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Time", "Admin", "Action", "Target Type", "Target ID", "Details"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "0.4rem 0.6rem",
                          color: "var(--text-muted)",
                          fontWeight: 500,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      style={{ borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={rowHoverEnter}
                      onMouseLeave={rowHoverLeave}
                    >
                      <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem" }}>
                        {entry.adminEmail}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", fontWeight: 500 }}>
                        {entry.action}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)" }}>
                        {entry.targetType}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {entry.targetId ? entry.targetId.slice(0, 8) + "..." : "—"}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", fontFamily: "monospace", fontSize: "0.7rem", color: "var(--text-muted)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {entry.details ? JSON.stringify(entry.details) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
