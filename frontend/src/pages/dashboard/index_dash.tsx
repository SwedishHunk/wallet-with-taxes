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
          title={studio?.studioName ?? "Okänd studio"}
          subtitle={`ID: ${studio?.studioId ?? "-"}`}
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
        title={studio?.studioName ?? "Okänd studio"}
        subtitle={`ID: ${studio?.studioId ?? "-"}`}
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

      {/* Game Wallet UI */}
      <Card>
        <WalletInfo />
      </Card>
    </Page>
  );
}
