import { Link } from "react-router-dom";
import "./RoleGateway.css";

export default function RoleGateway() {
  return (
    <div className="role-gateway">
      <div className="role-gateway__backdrop" />
      <div className="role-gateway__panel">
        <div className="role-gateway__eyebrow">Triolith Access Point</div>
        <h1 className="role-gateway__title">Välj hur du vill gå in i systemet</h1>
        <p className="role-gateway__intro">
          Player-flödet går till TokenShop, trading och portfolio. Spelägare går
          till studio-, medlem- och plattformsdelen.
        </p>

        <div className="role-gateway__choices">
          <Link className="role-card role-card--player" to="/player">
            <span className="role-card__label">Player</span>
            <span className="role-card__headline">Handla TRI och följ portfolio</span>
            <span className="role-card__body">
              Dashboard, trade, tax och wallet-koppling i samma frontend.
            </span>
          </Link>

          <Link className="role-card role-card--owner" to="/login">
            <span className="role-card__label">Spelägare</span>
            <span className="role-card__headline">
              Logga in till studio- och kontrollpanelen
            </span>
            <span className="role-card__body">
              Studio-login, members, games, settings och owner-styrning.
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
