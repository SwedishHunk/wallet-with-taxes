import { Fragment, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { api } from "../../lib/api";
import { Page, PageHeader, Card } from "../../components/ui/index";
import { useCountUp } from "../../hooks/useCountUp";

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

type TransactionRow = {
  id: number;
  type: string;
  userAddress: string;
  assetAddress: string;
  tokenId: number;
  amount: number;
  feeUSD: number;
  priceUSD: number | null;
  source: string | null;
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

/* ─── Main Component ──────────────────────────────────────── */

export default function TriolithAdminPage() {
  const [fees, setFees] = useState<FeeStats | null>(null);
  const [revenue, setRevenue] = useState<RevenueSplit | null>(null);
  const [studios, setStudios] = useState<StudioRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [txOffset, setTxOffset] = useState(0);
  const [platformFee, setPlatformFee] = useState<number | null>(null);
  const [feeInput, setFeeInput] = useState("");
  const [feeMsg, setFeeMsg] = useState("");
  const [expandedStudioId, setExpandedStudioId] = useState<string | null>(null);
  const [studioGames, setStudioGames] = useState<Record<string, GameRow[]>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const TX_LIMIT = 25;

  // Refs for GSAP animations
  const statsRowRef = useRef<HTMLDivElement>(null);
  const studiosRef = useRef<HTMLDivElement>(null);
  const gamesRef = useRef<HTMLDivElement>(null);
  const txRef = useRef<HTMLDivElement>(null);
  const usersRef = useRef<HTMLDivElement>(null);
  const auditRef = useRef<HTMLDivElement>(null);

  const fetchAuditLog = () => {
    void api
      .get<AuditResponse>("/admin/audit-log?limit=25")
      .then((r) => setAuditEntries(r.data.entries))
      .catch(() => {});
  };

  useEffect(() => {
    void api.get<FeeStats>("/admin/fees").then((r) => setFees(r.data));
    void api.get<RevenueSplit>("/admin/revenue").then((r) => setRevenue(r.data));
    void api.get<StudioRow[]>("/admin/studios").then((r) => setStudios(r.data));
    void api.get<UserRow[]>("/admin/users").then((r) => setUsers(r.data));
    void api.get<GameRow[]>("/admin/games").then((r) => setGames(r.data));
    fetchAuditLog();
    void api
      .get<{ feePercent: number }>("/admin/platform/fee")
      .then((r) => {
        setPlatformFee(r.data.feePercent);
        setFeeInput(String(r.data.feePercent));
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const sections = [studiosRef, gamesRef, txRef, usersRef, auditRef];
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

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 2 });

  const handleError = (err: unknown) => {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message ??
      (err instanceof Error ? err.message : "Action failed");
    setActionError(msg);
    setTimeout(() => setActionError(null), 4000);
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
      .then(() => { setStudios((prev) => prev.filter((s) => s.id !== studio.id)); fetchAuditLog(); })
      .catch(handleError);
  };

  const toggleStudioGames = (studioId: string) => {
    if (expandedStudioId === studioId) {
      setExpandedStudioId(null);
      return;
    }
    setExpandedStudioId(studioId);
    if (!studioGames[studioId]) {
      void api
        .get<GameRow[]>(`/admin/studios/${studioId}/games`)
        .then((r) => setStudioGames((prev) => ({ ...prev, [studioId]: r.data })))
        .catch(handleError);
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
      .then(() => { setGames((prev) => prev.map((g) => (g.id === game.id ? { ...g, status: next } : g))); fetchAuditLog(); })
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

      {/* ── Studios (scroll-triggered) ── */}
      <div ref={studiosRef}>
        <Card style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
            All Studios ({studios.length})
          </h3>
          {studios.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No studios yet.
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
                  {studios.map((s) => (
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
                            {studioGames[s.id] === undefined ? (
                              <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                                Loading games...
                              </span>
                            ) : studioGames[s.id].length === 0 ? (
                              <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                                No games for this studio.
                              </span>
                            ) : (
                              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.8rem" }}>
                                {studioGames[s.id].map((g) => (
                                  <li key={g.id} style={{ marginBottom: "0.2rem" }}>
                                    <strong>{g.name}</strong> ({g.slug}) — {g.status}
                                  </li>
                                ))}
                              </ul>
                            )}
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

      {/* ── Games (scroll-triggered) ── */}
      <div ref={gamesRef}>
        <Card style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
            All Games ({games.length})
          </h3>
          {games.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No games yet.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Name", "Slug", "Studio", "Status", "Created", "Action"].map((h) => (
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
                  {games.map((g) => (
                    <tr
                      key={g.id}
                      style={{ borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={rowHoverEnter}
                      onMouseLeave={rowHoverLeave}
                    >
                      <td style={{ padding: "0.4rem 0.6rem", fontWeight: 600 }}>
                        {g.name}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", fontFamily: "monospace", color: "var(--text-muted)" }}>
                        {g.slug}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)" }}>
                        {g.studioName ?? "—"}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem" }}>
                        <span
                          style={{
                            color: g.status === "active" ? "var(--success, #22c55e)" : "var(--text-muted)",
                            fontWeight: 500,
                          }}
                        >
                          {g.status}
                        </span>
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)" }}>
                        {new Date(g.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem" }}>
                        <button
                          onClick={() => toggleGameStatus(g)}
                          style={btnStyle(g.status === "active" ? "danger" : "success")}
                        >
                          {g.status === "active" ? "Suspend" : "Activate"}
                        </button>
                      </td>
                    </tr>
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
                    {["Type", "User Address", "Asset", "Token ID", "Amount", "Fee USD", "Tx Hash", "Time"].map((h) => (
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
                      <td style={{ padding: "0.4rem 0.6rem", fontWeight: 500 }}>
                        {tx.type}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {tx.userAddress ? tx.userAddress.slice(0, 10) + "..." : "—"}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {tx.assetAddress ? tx.assetAddress.slice(0, 10) + "..." : "—"}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)" }}>
                        {tx.tokenId ?? "—"}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", fontWeight: 600 }}>
                        {tx.amount}
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)" }}>
                        {tx.feeUSD != null ? `$${fmt(tx.feeUSD)}` : "—"}
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

      {/* ── Users (scroll-triggered) ── */}
      <div ref={usersRef}>
        <Card style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
            All Users ({users.length})
          </h3>
          {users.length === 0 ? (
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
                  {users.map((u) => (
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
