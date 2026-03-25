import type { User } from "../../types/user";

interface Props {
  user: User;
}

export default function UserInfo({ user }: Props) {
  return (
    <div className="border p-4 rounded shadow">
      <h2 className="text-xl font-semibold mb-2">User Info</h2>
      <p>
        <strong>Email:</strong> {user.email}
      </p>
      <p>
        <strong>Wallet:</strong> {user.walletAddress}
      </p>
      <p>
        <strong>Custody Mode:</strong> {user.custodyMode}
      </p>

      {user.studioId && (
        <p>
          <strong>Studio ID:</strong> {user.studioId}
        </p>
      )}
      <p>
        <strong>Admin:</strong> {user.isAdmin ? "Yes" : "No"}
      </p>
    </div>
  );
}
