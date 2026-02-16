import { useEffect, useState } from "react";
import { getGameWallet } from "../../lib/platform";
import { useAuthState } from "../../lib/AuthContext";

export default function WalletInfo() {
  const { authContext, activeGame } = useAuthState();
  const [balance, setBalance] = useState<string | null>(null);
  const [totalDeposited, setTotalDeposited] = useState<string | null>(null);
  const [totalWithdrawn, setTotalWithdrawn] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      authContext.state !== "StudioAuthenticated" &&
      authContext.state !== "Studio+MemberActive"
    ) {
      return;
    }

    if (!activeGame) {
      return;
    }

    setLoading(true);
    setError(null);

    getGameWallet(activeGame.gameId)
      .then((res) => {
        setBalance(res.data.balance);
        setTotalDeposited(res.data.totalDeposited);
        setTotalWithdrawn(res.data.totalWithdrawn);
      })
      .catch((err) => {
        console.error("Failed to load game wallet:", err);
        setError("Failed to load wallet");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [authContext.state, activeGame]);

  // Not authenticated
  if (
    authContext.state !== "StudioAuthenticated" &&
    authContext.state !== "Studio+MemberActive"
  ) {
    return <p>Not authenticated</p>;
  }

  // No active game selected
  if (!activeGame) {
    return <p>Välj ett spel först</p>;
  }

  // Loading or error
  if (loading) {
    return <p>Loading wallet...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div className="border rounded-lg p-4 shadow">
      <h2 className="text-lg font-semibold mb-2">Wallet Info</h2>
      <p>
        <strong>Balance:</strong> {balance}
      </p>
      <p>
        <strong>Total Deposited:</strong> {totalDeposited}
      </p>
      <p>
        <strong>Total Withdrawn:</strong> {totalWithdrawn}
      </p>
    </div>
  );
}
