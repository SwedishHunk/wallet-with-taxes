import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useAuthState } from "../../lib/AuthContext";

type EconomicEvent = {
  id: string;
  eventType: string;
  walletAddress: string | null;
  assetKey: string;
  amount: string;
  direction: "in" | "out" | "neutral";
  source: string;
  timestamp: string;
  gameId: string | null;
  metadata?: {
    gameName?: string;
    studioName?: string;
  } | null;
};

export default function StudioEconomicEventsPanel() {
  const { activeGame } = useAuthState();
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"studio" | "game">("studio");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const endpoint = useMemo(() => {
    if (scope === "game" && activeGame?.gameId) {
      return `/economics/studio?gameId=${encodeURIComponent(activeGame.gameId)}`;
    }

    return "/economics/studio";
  }, [scope, activeGame?.gameId]);

  const loadEvents = () => {
    setLoading(true);
    setError(null);

    api
      .get(endpoint)
      .then((res) => setEvents(res.data || []))
      .catch((err) => {
        console.error("Failed to load studio economic events:", err);
        setError("Failed to load studio economic events");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (scope === "game" && !activeGame?.gameId) {
      setScope("studio");
      return;
    }
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, scope, activeGame?.gameId]);

  useEffect(() => {
    const refresh = () => loadEvents();
    window.addEventListener("devtools:dashboard:refresh", refresh);
    return () =>
      window.removeEventListener("devtools:dashboard:refresh", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, scope, activeGame?.gameId]);

  const knownTypes = useMemo(
    () => Array.from(new Set(events.map((e) => e.eventType))).sort(),
    [events],
  );

  const visibleEvents = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter !== "all" && e.eventType !== typeFilter) return false;
      if (fromDate) {
        const ts = new Date(e.timestamp).getTime();
        const from = new Date(fromDate).getTime();
        if (ts < from) return false;
      }
      if (toDate) {
        const ts = new Date(e.timestamp).getTime();
        const to = new Date(toDate).getTime() + 86400000;
        if (ts > to) return false;
      }
      return true;
    });
  }, [events, typeFilter, fromDate, toDate]);

  return (
    <div className="border rounded-lg p-4 shadow">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Studio Economic Events</h2>
          <p className="text-sm text-gray-600">
            Aggregated player-attributed economic events across the current studio.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "studio" | "game")}
            className="rounded border px-3 py-1 text-xs text-gray-700"
          >
            <option value="studio">All studio games</option>
            <option value="game" disabled={!activeGame?.gameId}>
              {activeGame?.name ? `Active game only (${activeGame.name})` : "Active game only"}
            </option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded border px-3 py-1 text-xs text-gray-700"
          >
            <option value="all">All event types</option>
            {knownTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={loadEvents}
            className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            Refresh
          </button>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded border px-3 py-1 text-xs text-gray-700"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded border px-3 py-1 text-xs text-gray-700"
          />
        </div>
      </div>

      {loading ? <p className="text-gray-600">Loading studio events...</p> : null}
      {error ? <p className="text-red-600">{error}</p> : null}

      {!loading && !error && visibleEvents.length === 0 ? (
        <p className="text-gray-600">No studio-attributed economic events yet.</p>
      ) : null}

      <div className="space-y-2">
        {visibleEvents.map((event) => (
          <div
            key={event.id}
            className="flex items-start justify-between rounded border bg-gray-50 px-3 py-2 text-sm"
          >
            <div>
              <div className="font-medium">{event.eventType}</div>
              <div className="text-gray-600">
                {event.metadata?.gameName || event.gameId || "Unknown game"} ·{" "}
                {event.walletAddress ? `${event.walletAddress.slice(0, 8)}...` : "Unknown wallet"} ·{" "}
                {event.source}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(event.timestamp).toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">
                {event.direction === "out" ? "-" : event.direction === "in" ? "+" : ""}
                {event.amount} {event.assetKey.toUpperCase()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
