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
};

export default function EconomicEventsPanel() {
  const { activeGame } = useAuthState();
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const loadEvents = () => {
    if (!activeGame) {
      setEvents([]);
      return;
    }

    setLoading(true);
    setError(null);

    api
      .get(`/economics/game/${activeGame.gameId}`)
      .then((res) => setEvents(res.data || []))
      .catch((err) => {
        console.error("Failed to load economic events:", err);
        setError("Failed to load player economic events");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGame]);

  useEffect(() => {
    const refresh = () => loadEvents();
    window.addEventListener("devtools:dashboard:refresh", refresh);
    return () =>
      window.removeEventListener("devtools:dashboard:refresh", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGame?.gameId]);

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
        // include the whole toDate day
        const to = new Date(toDate).getTime() + 86400000;
        if (ts > to) return false;
      }
      return true;
    });
  }, [events, typeFilter, fromDate, toDate]);

  return (
    <div className="dashboard-events-panel">
      <div className="dashboard-events-header">
        <div>
          <h2 className="dashboard-events-title">Player Economic Events</h2>
          <p className="dashboard-events-subtitle">
            Latest game-attributed player trades for the currently selected game.
          </p>
        </div>
        <div className="dashboard-events-controls">
          <button
            type="button"
            onClick={loadEvents}
            className="dashboard-events-button"
          >
            Refresh
          </button>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="dashboard-events-input"
          >
            <option value="all">All event types</option>
            {knownTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="dashboard-events-input"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="dashboard-events-input"
          />
        </div>
      </div>

      {loading ? <p className="dashboard-events-message">Loading events...</p> : null}
      {error ? <p className="dashboard-events-message dashboard-events-message-error">{error}</p> : null}

      {!loading && !error && visibleEvents.length === 0 ? (
        <p className="dashboard-events-message">No attributed player events yet.</p>
      ) : null}

      <div className="dashboard-events-list">
        {visibleEvents.map((event) => (
          <div
            key={event.id}
            className="dashboard-event-card"
          >
            <div className="dashboard-event-main">
              <div className="dashboard-event-type">{event.eventType}</div>
              <div className="dashboard-event-meta">
                {event.walletAddress ? `${event.walletAddress.slice(0, 8)}...` : "Unknown wallet"} ·{" "}
                {event.source}
              </div>
              <div className="dashboard-event-time">
                {new Date(event.timestamp).toLocaleString()}
              </div>
            </div>
            <div className="dashboard-event-amount-wrap">
              <div
                className={`dashboard-event-amount ${
                  event.direction === "in"
                    ? "dashboard-event-amount-in"
                    : event.direction === "out"
                      ? "dashboard-event-amount-out"
                      : "dashboard-event-amount-neutral"
                }`}
              >
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
