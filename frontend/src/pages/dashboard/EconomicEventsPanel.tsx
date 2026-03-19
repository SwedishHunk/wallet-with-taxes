import { useEffect, useState } from "react";
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

  return (
    <div className="border rounded-lg p-4 shadow">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Player Economic Events</h2>
          <p className="text-sm text-gray-600">
            Latest game-attributed player trades for the currently selected game.
          </p>
        </div>
        <button
          type="button"
          onClick={loadEvents}
          className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {loading ? <p className="text-gray-600">Loading events...</p> : null}
      {error ? <p className="text-red-600">{error}</p> : null}

      {!loading && !error && events.length === 0 ? (
        <p className="text-gray-600">No attributed player events yet.</p>
      ) : null}

      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-start justify-between rounded border bg-gray-50 px-3 py-2 text-sm"
          >
            <div>
              <div className="font-medium">{event.eventType}</div>
              <div className="text-gray-600">
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
