import { useNavigate } from "react-router-dom";
import { useAuthState } from "../../lib/AuthContext";
import { useCanManageMembers } from "../../lib/useAuth";
import { ROUTES } from "../../routes";
import {
  Page,
  PageHeader,
  Card,
  Button,
  Badge,
} from "../../components/ui/index";
import WalletInfo from "./WalletInfo";
import EconomicEventsPanel from "./EconomicEventsPanel";
import "../../style/Dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const { authContext, membersCount, activeGame } = useAuthState();
  const canManageMembers = useCanManageMembers();

  const studio = authContext.studioSession;
  const member = authContext.memberSession;

  // If no active game is selected, show message
  if (!activeGame) {
    return (
      <Page>
        <PageHeader
          title="No active game selected"
          subtitle={`Studio: ${studio?.studioName ?? "Okänd studio"}`}
        />
        <Card>
          <h2>No active game selected</h2>
          <p>Du måste välja ett game för att fortsätta.</p>
          <Button onClick={() => navigate(ROUTES.games)}>Gå till Games</Button>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={activeGame.name}
        subtitle={`Game ID: ${activeGame.gameId}`}
      />

      {!member &&
        membersCount !== null &&
        membersCount > 1 &&
        authContext.state === "StudioAuthenticated" && (
          <Card>
            <h2>Ingen medlem aktiv</h2>
            <p>Logga in som medlem för att få åtkomst till admin-funktioner.</p>
            <Button
              onClick={() => {
                console.log(
                  "[Dashboard] Go to member-login",
                  ROUTES.memberLogin,
                );
                navigate(ROUTES.memberLogin);
              }}>
              Logga in som medlem
            </Button>
          </Card>
        )}

      {member && (
        <Card>
          <div className="mb-4">
            <h3 className="text-lg font-semibold">{activeGame.name}</h3>
            <p className="text-sm text-gray-500">
              Active game for current studio monitoring
            </p>
            <p className="text-xs text-gray-500 font-mono mt-1">
              Game ID: {activeGame.gameId}
            </p>
          </div>
          <div className="dashboard-member-section">
            <div className="dashboard-member-info">
              <h3>{member.email}</h3>
              <p className="dashboard-member-ids">
                Member ID: {member.memberId} | User ID: {member.userId}
              </p>
              {member.isOwner && <Badge variant="owner">Owner</Badge>}
            </div>

            <div className="dashboard-permissions">
              <h4>Permissions</h4>
              <div className="dashboard-badge-row">
                {member.permissions.length === 0 ? (
                  <Badge>Inga</Badge>
                ) : (
                  member.permissions.map((p) => (
                    <Badge key={p} variant="permission">
                      {p}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {canManageMembers && (
              <div className="dashboard-actions">
                <Button
                  variant="secondary"
                  onClick={() => navigate(ROUTES.members)}>
                  Hantera medlemmar
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <EconomicEventsPanel />
      </Card>

      <Card>
        <WalletInfo />
      </Card>
    </Page>
  );
}
