import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../routes";

// Legacy route: immediately redirect to unified personal account page
export default function CreateFirstPersonalAccount() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(ROUTES.accountLogin, { replace: true, state: { mode: "create" } });
  }, [navigate]);

  return null;
}
