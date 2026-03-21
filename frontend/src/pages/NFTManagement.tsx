import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getGameDetails,
  getNFTTemplates,
  createNFTTemplate,
  mintNFT,
  getGamePlayers,
  getAllNFTInstances,
} from "../lib/platform";
import { ROUTES } from "../routes";
import { Page, PageHeader, Card, Button, Badge } from "../components/ui/index";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NFTTemplate {
  id: string;
  name: string;
  tier: number;
  mintingCost: string;
  upkeepCostPerDay: string;
  maxMintCount: number | null;
  currentMintCount: number;
  attributes: Record<string, unknown>;
  createdAt: string;
}

interface GamePlayer {
  id: string;
  level: number;
  joinedAt: string;
  user?: { id: string; email: string; walletAddress?: string };
  studioUser?: { id: string; email: string };
}

interface NFTInstance {
  id: string;
  name: string;
  level: number;
  condition: number;
  power: number;
  equipped: boolean;
  createdAt: string;
  template: { id: string; name: string; tier: number };
  owner: {
    id: string;
    user?: { email: string; walletAddress?: string };
    studioUser?: { email: string };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_LABELS: Record<number, string> = { 1: "Common", 2: "Rare", 3: "Epic", 4: "Legendary" };
const TIER_COLORS: Record<number, string> = {
  1: "var(--muted)",
  2: "#4fc3f7",
  3: "#ce93d8",
  4: "#ffb74d",
};

function tierBadgeStyle(tier: number): React.CSSProperties {
  return { color: TIER_COLORS[tier] ?? "var(--muted)", fontWeight: 700, fontSize: 12 };
}

function playerLabel(p: GamePlayer) {
  if (p.user?.email) return `${p.user.email}${p.user.walletAddress ? ` (${p.user.walletAddress.slice(0, 8)}…)` : ""}`;
  if (p.studioUser?.email) return `Studio: ${p.studioUser.email}`;
  return `Player #${p.id.slice(0, 8)}`;
}

function ownerLabel(inst: NFTInstance) {
  if (inst.owner.user?.email) return inst.owner.user.email;
  if (inst.owner.studioUser?.email) return inst.owner.studioUser.email;
  return `Player #${inst.owner.id.slice(0, 8)}`;
}

function conditionColor(c: number) {
  if (c >= 75) return "#4caf50";
  if (c >= 40) return "#ff9800";
  return "#f44336";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NFTManagement() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const [gameName, setGameName] = useState("");
  const [templates, setTemplates] = useState<NFTTemplate[]>([]);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [instances, setInstances] = useState<NFTInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Tab
  const [tab, setTab] = useState<"templates" | "minted">("templates");

  // Create template form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTier, setNewTier] = useState(1);
  const [newMintingCost, setNewMintingCost] = useState("0");
  const [newUpkeep, setNewUpkeep] = useState("0");
  const [newMaxMint, setNewMaxMint] = useState("");
  const [newAttrs, setNewAttrs] = useState("{}");
  const [attrsError, setAttrsError] = useState("");

  // Mint flow
  const [mintingTemplateId, setMintingTemplateId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [minting, setMinting] = useState(false);

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(""), 3500); }
    else { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); }
  };

  const load = useCallback(async () => {
    if (!gameId) return;
    try {
      setLoading(true);
      const [gameRes, tplRes, playersRes, instRes] = await Promise.all([
        getGameDetails(gameId),
        getNFTTemplates(gameId),
        getGamePlayers(gameId),
        getAllNFTInstances(gameId),
      ]);
      setGameName(gameRes.data?.name ?? "");
      setTemplates(tplRes.data ?? []);
      setPlayers(playersRes.data ?? []);
      setInstances(instRes.data ?? []);
    } catch (e: unknown) {
      flash(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? "Failed to load NFT data",
        true,
      );
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleRefresh = () => {
      void load();
    };

    window.addEventListener("devtools:nfts:refresh", handleRefresh);
    return () => {
      window.removeEventListener("devtools:nfts:refresh", handleRefresh);
    };
  }, [load]);

  // ── Create Template ────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttrsError("");
    let attrs: Record<string, unknown> = {};
    try { attrs = JSON.parse(newAttrs); } catch {
      setAttrsError("Attributes must be valid JSON (e.g. {\"speed\": 10})");
      return;
    }
    if (!newName.trim()) return;
    try {
      setCreating(true);
      await createNFTTemplate(gameId!, {
        name: newName.trim(),
        tier: newTier,
        mintingCost: newMintingCost || "0",
        upkeepCostPerDay: newUpkeep || "0",
        maxMintCount: newMaxMint ? parseInt(newMaxMint) : undefined,
        attributes: attrs,
      });
      setShowCreate(false);
      setNewName(""); setNewTier(1); setNewMintingCost("0");
      setNewUpkeep("0"); setNewMaxMint(""); setNewAttrs("{}");
      flash("Template created!");
      load();
    } catch (e: unknown) {
      flash(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? "Failed to create template",
        true,
      );
    } finally {
      setCreating(false);
    }
  };

  // ── Mint NFT ───────────────────────────────────────────────────────────────

  const handleMint = async () => {
    if (!mintingTemplateId) return;
    try {
      setMinting(true);
      await mintNFT(gameId!, mintingTemplateId, selectedPlayerId || undefined);
      setMintingTemplateId(null);
      setSelectedPlayerId("");
      flash("NFT minted successfully!");
      load();
    } catch (e: unknown) {
      flash(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? "Minting failed",
        true,
      );
    } finally {
      setMinting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Page>
      <PageHeader
        title="NFT Management"
        subtitle={gameName ? `${gameName} — Templates & Minted Collectibles` : "Loading…"}
      >
        <Button variant="secondary" onClick={() => navigate(ROUTES.games)}>
          ← Back to Games
        </Button>
      </PageHeader>

      {/* Alerts */}
      {(error || success) && (
        <div style={{
          padding: "12px 16px",
          borderRadius: 8,
          marginBottom: 16,
          background: error ? "rgba(244,67,54,0.12)" : "rgba(76,175,80,0.12)",
          border: `1px solid ${error ? "rgba(244,67,54,0.4)" : "rgba(76,175,80,0.4)"}`,
          color: error ? "#ef5350" : "#66bb6a",
          fontSize: 14,
        }}>
          {error || success}
        </div>
      )}

      {loading ? (
        <Card><p style={{ color: "var(--muted)" }}>Loading…</p></Card>
      ) : (
        <>
          {/* ── Tabs ── */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {(["templates", "minted"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: tab === t ? "var(--primary)" : "var(--glass-border)",
                  background: tab === t ? "rgba(0,212,255,0.12)" : "transparent",
                  color: tab === t ? "var(--primary)" : "var(--muted)",
                  fontWeight: tab === t ? 700 : 400,
                  cursor: "pointer",
                  fontSize: 14,
                  letterSpacing: "0.02em",
                  transition: "all 0.2s",
                }}
              >
                {t === "templates"
                  ? `Templates (${templates.length})`
                  : `Minted NFTs (${instances.length})`}
              </button>
            ))}
          </div>

          {/* ══════════════ TEMPLATES TAB ══════════════ */}
          {tab === "templates" && (
            <>
              {/* Template list */}
              {templates.length === 0 ? (
                <Card>
                  <p style={{ color: "var(--muted)", margin: 0 }}>
                    No templates yet. Create one below to start minting NFTs.
                  </p>
                </Card>
              ) : (
                <Card>
                  <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--text-bright)" }}>
                    Templates
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {templates.map((tpl) => {
                      const atLimit = tpl.maxMintCount !== null && tpl.currentMintCount >= tpl.maxMintCount;
                      return (
                        <div
                          key={tpl.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            alignItems: "center",
                            gap: 16,
                            padding: "14px 16px",
                            borderRadius: 8,
                            border: "1px solid var(--glass-border)",
                            background: "rgba(255,255,255,0.03)",
                          }}
                        >
                          {/* Info */}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 24px", alignItems: "center" }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-bright)" }}>
                              {tpl.name}
                            </span>
                            <span style={tierBadgeStyle(tpl.tier)}>
                              ★ {TIER_LABELS[tpl.tier] ?? `Tier ${tpl.tier}`}
                            </span>
                            <span style={{ fontSize: 12, color: "var(--muted)" }}>
                              Minted: <strong style={{ color: "var(--text)" }}>
                                {tpl.currentMintCount}{tpl.maxMintCount != null ? `/${tpl.maxMintCount}` : ""}
                              </strong>
                            </span>
                            {tpl.mintingCost !== "0" && (
                              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                                Cost: <strong style={{ color: "var(--text)" }}>{tpl.mintingCost}</strong>
                              </span>
                            )}
                            {tpl.upkeepCostPerDay !== "0" && (
                              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                                Upkeep/day: <strong style={{ color: "var(--text)" }}>{tpl.upkeepCostPerDay}</strong>
                              </span>
                            )}
                            {Object.keys(tpl.attributes).length > 0 && (
                              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                                Attrs: {Object.entries(tpl.attributes).map(([k, v]) => `${k}:${v}`).join(", ")}
                              </span>
                            )}
                            {atLimit && (
                              <Badge variant="studio">Mint limit reached</Badge>
                            )}
                          </div>

                          {/* Mint action */}
                          {mintingTemplateId === tpl.id ? (
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <select
                                value={selectedPlayerId}
                                onChange={(e) => setSelectedPlayerId(e.target.value)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 6,
                                  border: "1px solid var(--glass-border)",
                                  background: "var(--glass-bg)",
                                  color: "var(--text)",
                                  fontSize: 13,
                                  minWidth: 160,
                                }}
                              >
                                <option value="">
                                  {players.length === 0 ? "No players yet" : "Select player…"}
                                </option>
                                {players.map((p) => (
                                  <option key={p.id} value={p.id}>{playerLabel(p)}</option>
                                ))}
                              </select>
                              <Button
                                onClick={handleMint}
                                disabled={minting || players.length === 0}
                              >
                                {minting ? "Minting…" : "Confirm"}
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => { setMintingTemplateId(null); setSelectedPlayerId(""); }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              disabled={atLimit}
                              onClick={() => {
                                setMintingTemplateId(tpl.id);
                                setSelectedPlayerId(players[0]?.id ?? "");
                              }}
                            >
                              Mint NFT
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Create template */}
              <Card>
                {!showCreate ? (
                  <Button onClick={() => setShowCreate(true)}>+ Create Template</Button>
                ) : (
                  <form onSubmit={handleCreate}>
                    <h3 style={{ margin: "0 0 20px", fontSize: 16, color: "var(--text-bright)" }}>
                      New NFT Template
                    </h3>
                    <div style={{ display: "grid", gap: 14 }}>
                      {/* Name */}
                      <div>
                        <label style={labelStyle}>Name *</label>
                        <input
                          type="text"
                          required
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="e.g. Dragon Sword"
                          style={inputStyle}
                        />
                      </div>

                      {/* Tier + Max Mints */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={labelStyle}>Tier</label>
                          <select
                            value={newTier}
                            onChange={(e) => setNewTier(Number(e.target.value))}
                            style={inputStyle}
                          >
                            {[1, 2, 3, 4].map((t) => (
                              <option key={t} value={t}>{t} — {TIER_LABELS[t]}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Max Mints (blank = unlimited)</label>
                          <input
                            type="number"
                            min={1}
                            value={newMaxMint}
                            onChange={(e) => setNewMaxMint(e.target.value)}
                            placeholder="Unlimited"
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      {/* Costs */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={labelStyle}>Minting Cost</label>
                          <input
                            type="text"
                            value={newMintingCost}
                            onChange={(e) => setNewMintingCost(e.target.value)}
                            placeholder="0"
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Upkeep Cost / Day</label>
                          <input
                            type="text"
                            value={newUpkeep}
                            onChange={(e) => setNewUpkeep(e.target.value)}
                            placeholder="0"
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      {/* Custom attributes */}
                      <div>
                        <label style={labelStyle}>Custom Attributes (JSON)</label>
                        <textarea
                          value={newAttrs}
                          onChange={(e) => { setNewAttrs(e.target.value); setAttrsError(""); }}
                          rows={3}
                          placeholder='{"speed": 10, "defense": 5}'
                          style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 13 }}
                        />
                        {attrsError && (
                          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#ef5350" }}>{attrsError}</p>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <Button type="submit" disabled={creating}>
                          {creating ? "Creating…" : "Create Template"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setShowCreate(false);
                            setNewName(""); setNewTier(1);
                            setNewMintingCost("0"); setNewUpkeep("0");
                            setNewMaxMint(""); setNewAttrs("{}");
                            setAttrsError("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </form>
                )}
              </Card>
            </>
          )}

          {/* ══════════════ MINTED NFTs TAB ══════════════ */}
          {tab === "minted" && (
            <Card>
              <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--text-bright)" }}>
                All Minted NFTs
              </h3>
              {instances.length === 0 ? (
                <p style={{ color: "var(--muted)", margin: 0 }}>
                  No NFTs minted yet. Go to Templates and click "Mint NFT".
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        {["Name", "Template", "Tier", "Owner", "Lvl", "Condition", "Power", "Equipped"].map((h) => (
                          <th key={h} style={thStyle}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {instances.map((inst) => (
                        <tr key={inst.id} style={{ borderTop: "1px solid var(--glass-border)" }}>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: 600, color: "var(--text-bright)" }}>{inst.name}</span>
                          </td>
                          <td style={tdStyle}>{inst.template.name}</td>
                          <td style={{ ...tdStyle, ...tierBadgeStyle(inst.template.tier) }}>
                            {TIER_LABELS[inst.template.tier] ?? `T${inst.template.tier}`}
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12, color: "var(--muted)" }}>
                            {ownerLabel(inst)}
                          </td>
                          <td style={tdStyle}>{inst.level}</td>
                          <td style={tdStyle}>
                            <span style={{ color: conditionColor(inst.condition), fontWeight: 600 }}>
                              {inst.condition}%
                            </span>
                          </td>
                          <td style={tdStyle}>{inst.power}</td>
                          <td style={tdStyle}>
                            {inst.equipped ? (
                              <span style={{ color: "#ff9800", fontWeight: 700, fontSize: 12 }}>EQUIPPED</span>
                            ) : (
                              <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </Page>
  );
}

// ─── Style constants ──────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--muted)",
  marginBottom: 5,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 6,
  border: "1px solid var(--glass-border)",
  background: "rgba(255,255,255,0.04)",
  color: "var(--text)",
  fontSize: 14,
  boxSizing: "border-box",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  textAlign: "left",
  fontSize: 11,
  color: "var(--muted)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  borderBottom: "1px solid var(--glass-border)",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  color: "var(--text)",
};
