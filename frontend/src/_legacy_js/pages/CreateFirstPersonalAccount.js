import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
// Legacy route: immediately redirect to unified personal account page
export default function CreateFirstPersonalAccount() {
    const navigate = useNavigate();
    useEffect(() => {
        navigate("/account-login", { replace: true, state: { mode: "create" } });
    }, [navigate]);
    return null;
}
