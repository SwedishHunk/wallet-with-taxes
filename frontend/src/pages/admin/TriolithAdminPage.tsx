import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Page, PageHeader, Card } from "../../components/ui/index";

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
  id: string;
  eventType: string;
  source: string;
  studioId: string | null;
  gameId: string | null;
  walletAddress: string | null;
  assetKey: string;
  amount: string;
  direction: "in" | "out" | "neutral";
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
  padding: "0.2rem 0.6rem",
  fontSize: "0.75rem",
  borderRadius: "4px",
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  background:
    variant === "danger"
      ? "var(--danger, #ef4444)"
      : variant === "success"
        ? "var(--success, #22c55e)"
        : "var(--border)",
  color: variant === "neutral" ? "var(--text)" : "#fff",
});

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
  const TX_LIMIT = 25;

  useEffect(() => {
    void api.get<FeeStats>("/admin/fees").then((r) => setFees(r.data));
    void api.get<RevenueSplit>("/admin/revenue").then((r) => setRevenue(r.data));
    void api.get<StudioRow[]>("/admin/studios").then((r) => setStudios(r.data));
    void api.get<UserRow[]>("/admin/users").then((r) => setUsers(r.data));
    void api.get<GameRow[]>("/admin/games").then((r) => setGames(r.data));
    void api.get<AuditResponse>("/admin/audit-log?limit=25").then((r) => setAuditEntries(r.data.entries));
    void api
      .get<{ feePercent: number }>("/admin/platform/fee")
      .then((r) => {
        setPlatformFee(r.data.feePercent);
        setFeeInput(String(r.data.feePercent));
      });
  }, []);

  useEffect(() => {
    void api
      .get<TransactionsResponse>(
        `/admin/transactions?limit=${TX_LIMIT}&offset=${txOffset}`,
      )
      .then((r) => {
        setTransactions(r.data.events);
        setTxTotal(r.data.total);
      });
  }, [txOffset]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 2 });

  const toggleStudioStatus = (studio: StudioRow) => {
    const next = studio.status === "active" ? "suspended" : "active";
    void api
      .patch<{ id: string; status: string }>(`/admin/studios/${studio.id}/status`, { status: next })
      .then(() => {
        setStudios((prev) =>
          prev.map((s) => (s.id === studio.id ? { ...s, status: next } : s)),
        );
      });
  };

  const deleteStudio = (studio: StudioRow) => {
    if (!window.confirm(`Delete studio "${studio.name}"? This cannot be undone.`)) return;
    void api
      .delete<{ id: string; deleted: boolean }>(`/admin/studios/${studio.id}`)
      .then(() => {
        setStudios((prev) => prev.filter((s) => s.id !== studio.id));
      });
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
        .then((r) => {
          setStudioGames((prev) => ({ ...prev, [studioId]: r.data }));
        });
    }
  };

  const toggleUserAdmin = (user: UserRow) => {
    const next = !user.isAdmin;
    void api
      .patch<{ id: string; isAdmin: boolean }>(`/admin/users/${user.id}/admin`, { isAdmin: next })
      .then(() => {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isAdmin: next } : u)),
        );
      });
  };

  const toggleUserSuspended = (user: UserRow) => {
    const next = !user.isSuspended;
    void api
      .patch<{ id: string; isSuspended: boolean }>(`/admin/users/${user.id}/suspended`, { suspended: next })
      .then(() => {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isSuspended: next } : u)),
        );
      });
  };

  const deleteUser = (user: UserRow) => {
    if (!window.confirm(`Delete user "${user.email}"? This cannot be undone.`)) return;
    void api
      .delete<{ id: string; deleted: boolean }>(`/admin/users/${user.id}`)
      .then(() => {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
      });
  };

  const toggleGameStatus = (game: GameRow) => {
    const next: "active" | "inactive" = game.status === "active" ? "inactive" : "active";
    void api
      .patch<{ id: string; status: string }>(`/admin/games/${game.id}/status`, { status: next })
      .then(() => {
        setGames((prev) =>
          prev.map((g) => (g.id === game.id ? { ...g, status: next } : g)),
        );
      });
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
      });
  };

  return (
    <Page>
      <PageHeader title="Triolith Admin" subtitle="Platform-wide overview" />

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
        <Card>
          <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>Platform Fee Stats</h3>
          {fees ? (
            <table style={{ width: "100%", fontSize: "0.875rem" }}>
              <tbody>
                <tr>
                  <td style={{ color: "var(--text-muted)", paddingBottom: "0.4rem" }}>Total fees collected</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>${fmt(fees.totalFeesUSD)}</td>
                </tr>
                <tr>
                  <td style={{ color: "var(--text-muted)" }}>Total trades</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{fees.totalTrades}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading...</p>
          )}
        </Card>

        <Card>
          <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>Revenue Split</h3>
          {revenue ? (
            <table style={{ width: "100%", fontSize: "0.875rem" }}>
              <tbody>
                {[
                  { label: "Dev share (60%)", value: revenue.devShareUSD },
                  { label: "Triolith net (28.5%)", value: revenue.triolithNetUSD },
                  { label: "SAFU cut (1.5%)", value: revenue.safuShareUSD },
                  { label: "Staker share (10%)", value: revenue.stakerShareUSD },
                ].map((row) => (
                  <tr key={row.label}>
                    <td style={{ color: "var(--text-muted)", paddingBottom: "0.3rem" }}>{row.label}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>${fmt(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading...</p>
          )}
        </Card>

        <Card>
          <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>Platform Fee Rate</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "0.75rem" }}>
            Current: <strong>{platformFee !== null ? `${platformFee}%` : "..."}</strong>
          </p>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={feeInput}
              onChange={(e) => setFeeInput(e.target.value)}
              style={{ width: "80px", padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
            />
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>%</span>
            <button onClick={savePlatformFee} style={btnStyle("neutral")}>
              Save
            </button>
          </div>
          {feeMsg && (
            <p style={{ marginTop: "0.4rem", fontSize: "0.8rem", color: "var(--success, #22c55e)" }}>
              {feeMsg}
            </p>
          )}
        </Card>
      </div>

      {/* ── Studios ── */}
      <Card style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
          All Studios ({studios.length})
        </h3>
        {studios.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No studios yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Name", "Email", "Members", "Status", "Created", "Actions"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.6rem", color: "var(--text-muted)", fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studios.map((s) => (
                  <>
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.4rem 0.6rem", fontWeight: 600 }}>
                        <button
                          onClick={() => toggleStudioGames(s.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0, color: "var(--text)" }}
                        >
                          {expandedStudioId === s.id ? "▼" : "▶"} {s.name}
                        </button>
                      </td>
                      <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)" }}>{s.email}</td>
                      <td style={{ padding: "0.4rem 0.6rem" }}>{s.memberCount}</td>
                      <td style={{ padding: "0.4rem 0.6rem" }}>
                        <span style={{ color: s.status === "active" ? "var(--success, #22c55e)" : "var(--danger, #ef4444)", fontWeight: 500 }}>
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
                          <button
                            onClick={() => deleteStudio(s)}
                            style={btnStyle("danger")}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedStudioId === s.id && (
                      <tr key={`${s.id}-games`} style={{ background: "var(--surface-alt, #f9f9f9)" }}>
                        <td colSpan={6} style={{ padding: "0.5rem 1.5rem 0.75rem" }}>
                          {studioGames[s.id] === undefined ? (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Loading games...</span>
                          ) : studioGames[s.id].length === 0 ? (
                            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No games for this studio.</span>
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
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Games ── */}
      <Card style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
          All Games ({games.length})
        </h3>
        {games.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No games yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Name", "Slug", "Studio", "Status", "Created", "Action"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.6rem", color: "var(--text-muted)", fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.4rem 0.6rem", fontWeight: 600 }}>{g.name}</td>
                    <td style={{ padding: "0.4rem 0.6rem", fontFamily: "monospace", color: "var(--text-muted)" }}>{g.slug}</td>
                    <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)" }}>{g.studioName ?? "—"}</td>
                    <td style={{ padding: "0.4rem 0.6rem" }}>
                      <span style={{ color: g.status === "active" ? "var(--success, #22c55e)" : "var(--text-muted)", fontWeight: 500 }}>
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

      {/* ── Transactions ── */}
      <Card style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h3 style={{ fontWeight: 600 }}>
            All Transactions ({txTotal} total)
          </h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              disabled={txOffset === 0}
              onClick={() => setTxOffset(Math.max(0, txOffset - TX_LIMIT))}
              style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem", cursor: txOffset === 0 ? "not-allowed" : "pointer", opacity: txOffset === 0 ? 0.4 : 1 }}
            >
              Prev
            </button>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", alignSelf: "center" }}>
              {txOffset + 1}–{Math.min(txOffset + TX_LIMIT, txTotal)} of {txTotal}
            </span>
            <button
              disabled={txOffset + TX_LIMIT >= txTotal}
              onClick={() => setTxOffset(txOffset + TX_LIMIT)}
              style={{ padding: "0.25rem 0.75rem", fontSize: "0.8rem", cursor: txOffset + TX_LIMIT >= txTotal ? "not-allowed" : "pointer", opacity: txOffset + TX_LIMIT >= txTotal ? 0.4 : 1 }}
            >
              Next
            </button>
          </div>
        </div>
        {transactions.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No transactions yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Type", "Source", "Studio", "Game", "Wallet", "Amount", "Dir", "Time"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.6rem", color: "var(--text-muted)", fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.4rem 0.6rem", fontWeight: 500 }}>{tx.eventType}</td>
                    <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)" }}>{tx.source}</td>
                    <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)", fontFamily: "monospace", fontSize: "0.75rem" }}>
                      {tx.studioId ? tx.studioId.slice(0, 8) + "..." : "—"}
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)", fontFamily: "monospace", fontSize: "0.75rem" }}>
                      {tx.gameId ? tx.gameId.slice(0, 8) + "..." : "—"}
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem", fontFamily: "monospace", fontSize: "0.75rem" }}>
                      {tx.walletAddress ? tx.walletAddress.slice(0, 8) + "..." : "—"}
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem", fontWeight: 600 }}>
                      {tx.direction === "out" ? "-" : tx.direction === "in" ? "+" : ""}
                      {tx.amount} {tx.assetKey.toUpperCase()}
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem" }}>
                      <span style={{
                        color: tx.direction === "in" ? "var(--success, #22c55e)" : tx.direction === "out" ? "var(--danger, #ef4444)" : "var(--text-muted)",
                        fontWeight: 500,
                      }}>
                        {tx.direction}
                      </span>
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

      {/* ── Users ── */}
      <Card style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
          All Users ({users.length})
        </h3>
        {users.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No users yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Email", "Wallet", "Custody", "KYC", "Admin", "Status", "Created", "Actions"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.6rem", color: "var(--text-muted)", fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--border)", opacity: u.isSuspended ? 0.6 : 1 }}>
                    <td style={{ padding: "0.4rem 0.6rem", fontWeight: 500 }}>{u.email}</td>
                    <td style={{ padding: "0.4rem 0.6rem", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {u.walletAddress ? u.walletAddress.slice(0, 10) + "..." : "—"}
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem" }}>{u.custodyMode}</td>
                    <td style={{ padding: "0.4rem 0.6rem" }}>
                      <span style={{ color: u.kycStatus === "verified" ? "var(--success, #22c55e)" : "var(--text-muted)" }}>
                        {u.kycStatus}
                      </span>
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem" }}>
                      <span style={{ color: u.isAdmin ? "var(--success, #22c55e)" : "var(--text-muted)" }}>
                        {u.isAdmin ? "Admin" : "—"}
                      </span>
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem" }}>
                      <span style={{ color: u.isSuspended ? "var(--danger, #ef4444)" : "var(--success, #22c55e)", fontWeight: 500 }}>
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

      {/* ── Audit Log ── */}
      <Card>
        <h3 style={{ marginBottom: "0.75rem", fontWeight: 600 }}>
          Audit Log (last 25)
        </h3>
        {auditEntries.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No audit entries yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Time", "Admin", "Action", "Target Type", "Target ID", "Details"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.6rem", color: "var(--text-muted)", fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditEntries.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem" }}>{entry.adminEmail}</td>
                    <td style={{ padding: "0.4rem 0.6rem", fontWeight: 500 }}>{entry.action}</td>
                    <td style={{ padding: "0.4rem 0.6rem", color: "var(--text-muted)" }}>{entry.targetType}</td>
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
    </Page>
  );
}
