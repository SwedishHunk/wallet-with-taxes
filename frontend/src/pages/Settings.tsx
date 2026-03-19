import { useEffect, useState } from "react";
import { Page, PageHeader, Card } from "../components/ui/index";
import { useAuthState } from "../lib/AuthContext";
import { useLanguage } from "../lib/LanguageContext";
import { api } from "../lib/api";

type ShopConfig = {
  feeBps: number;
  feePercent: string;
  paused: boolean;
  maxEthIn: string;
  maxGenIn: string;
  rates?: { eth?: { buyRate: string; sellRate: string } };
  valuation?: { ethUsd?: number; usdSek?: number; source?: string };
};

const inputCls =
  "w-full px-3 py-2 rounded-lg text-sm border border-white/10 bg-black/40 text-slate-100 " +
  "placeholder-slate-500 focus:outline-none focus:border-indigo-400/40 focus:ring-1 focus:ring-indigo-400/10 transition-colors";

export default function Settings() {
  const { authContext } = useAuthState();
  const { t } = useLanguage();
  const studio = authContext.studioSession;
  const member = authContext.memberSession;

  const [shopConfig, setShopConfig] = useState<ShopConfig | null>(null);
  const [ethUsd, setEthUsd] = useState("");
  const [usdSek, setUsdSek] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void api.get<ShopConfig>("/api/shop/config").then((r) => {
      setShopConfig(r.data);
      setEthUsd(String(r.data.valuation?.ethUsd ?? ""));
      setUsdSek(String(r.data.valuation?.usdSek ?? ""));
    });
  }, []);

  const saveValuation = async () => {
    setLoading(true);
    setSaveMsg("");
    try {
      await api.post("/api/shop/valuation", {
        ethUsd: ethUsd ? parseFloat(ethUsd) : undefined,
        usdSek: usdSek ? parseFloat(usdSek) : undefined,
      });
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch {
      setSaveMsg("Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page>
      <PageHeader title={t("settings.title")} subtitle="Studio configuration and preferences" />

      {/* ── Studio Profile ── */}
      <Card style={{ marginBottom: "1rem" }}>
        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem", fontWeight: 600 }}>
          Studio Profile
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          {/* Studio Name */}
          <div style={{ background: "rgba(129,140,248,0.05)", border: "1px solid rgba(129,140,248,0.12)", borderRadius: 10, padding: "12px 14px" }}>
            <p style={{ fontSize: "0.68rem", color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Studio Name</p>
            <p style={{ fontWeight: 700, fontSize: "1rem" }}>{studio?.studioName ?? "—"}</p>
          </div>
          {/* Role */}
          <div style={{ background: member?.isOwner ? "rgba(251,191,36,0.05)" : "rgba(255,255,255,0.03)", border: member?.isOwner ? "1px solid rgba(251,191,36,0.15)" : "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "12px 14px" }}>
            <p style={{ fontSize: "0.68rem", color: member?.isOwner ? "#fbbf24" : "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Role</p>
            <p style={{ fontWeight: 700, fontSize: "1rem", color: member?.isOwner ? "#fbbf24" : "var(--text)" }}>{member?.isOwner ? "Owner" : "Member"}</p>
          </div>
          {/* Email */}
          <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px" }}>
            <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Logged in as</p>
            <p style={{ fontSize: "0.875rem", color: "var(--text)" }}>{member?.email ?? "—"}</p>
          </div>
          {/* Studio ID */}
          <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px" }}>
            <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Studio ID</p>
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-muted)", wordBreak: "break-all" }}>{studio?.studioId ?? "—"}</p>
          </div>
        </div>
      </Card>

      {/* ── Token Shop ── */}
      <Card style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Token Shop</p>
          {shopConfig && (
            <span style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              padding: "0.2rem 0.7rem",
              borderRadius: 20,
              background: shopConfig.paused ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
              color: shopConfig.paused ? "#ef4444" : "#22c55e",
              border: `1px solid ${shopConfig.paused ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)"}`,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}>
              {shopConfig.paused ? "Paused" : "Active"}
            </span>
          )}
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.9rem" }}>
          Edit fee, rates, and limits from the Player Portal Admin panel.
        </p>
        {shopConfig ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.6rem" }}>
            {[
              { label: "Platform Fee", value: `${shopConfig.feeBps} bps  ·  ${shopConfig.feePercent}%`, accent: "#a78bfa" },
              { label: "ETH Buy Rate", value: shopConfig.rates?.eth?.buyRate ?? "—", accent: "#4ade80" },
              { label: "ETH Sell Rate", value: shopConfig.rates?.eth?.sellRate ?? "—", accent: "#f87171" },
              { label: "Max ETH In", value: Number(shopConfig.maxEthIn) > 0 ? shopConfig.maxEthIn + " ETH" : "Unlimited", accent: undefined },
              { label: "Max TRI In", value: Number(shopConfig.maxGenIn) > 0 ? shopConfig.maxGenIn + " TRI" : "Unlimited", accent: undefined },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{
                background: accent ? `${accent}08` : "rgba(0,0,0,0.25)",
                borderRadius: 10,
                padding: "10px 14px",
                border: `1px solid ${accent ? accent + "20" : "rgba(255,255,255,0.06)"}`,
              }}>
                <p style={{ fontSize: "0.67rem", color: accent ?? "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{label}</p>
                <p style={{ fontSize: "0.875rem", fontFamily: "monospace", fontWeight: 600, color: accent ?? "var(--text)" }}>{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading…</p>
        )}
      </Card>

      {/* ── Fiat Valuation Snapshot ── */}
      <Card>
        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.4rem", fontWeight: 600 }}>
          Fiat Valuation Snapshot
        </p>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1.1rem", lineHeight: 1.6 }}>
          Manually set ETH/USD and USD/SEK exchange rates. Used to show approximate fiat value in player portfolios.
          Stored in memory — resets on server restart.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", maxWidth: 400 }}>
          <div>
            <label style={{ display: "block", fontSize: "0.68rem", color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              ETH / USD
            </label>
            <input
              type="number"
              value={ethUsd}
              onChange={(e) => setEthUsd(e.target.value)}
              placeholder="e.g. 3200"
              className={inputCls}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.68rem", color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              USD / SEK
            </label>
            <input
              type="number"
              value={usdSek}
              onChange={(e) => setUsdSek(e.target.value)}
              placeholder="e.g. 10.5"
              className={inputCls}
            />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1rem" }}>
          <button
            onClick={saveValuation}
            disabled={loading}
            style={{
              padding: "0.45rem 1.4rem",
              borderRadius: 8,
              border: "1px solid rgba(129,140,248,0.35)",
              background: "rgba(129,140,248,0.1)",
              color: "#a78bfa",
              fontWeight: 700,
              fontSize: "0.83rem",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              letterSpacing: "0.04em",
            }}
          >
            {loading ? "Saving…" : "Save"}
          </button>
          {saveMsg && (
            <span style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: saveMsg === "Saved" ? "#22c55e" : "#ef4444",
            }}>
              {saveMsg === "Saved" ? "✓ Saved" : "✗ Save failed"}
            </span>
          )}
        </div>
      </Card>
    </Page>
  );
}
