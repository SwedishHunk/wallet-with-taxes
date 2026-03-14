// src/App.tsx
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";
import { setAuthToken } from "./lib/api";
import { AuthProvider } from "./lib/AuthContext";
import { LanguageProvider } from "./lib/LanguageContext";
import LanguageToggle from "./components/LanguageToggle";
import { useDocumentTitle } from "./lib/useDocumentTitle";
import { APP_NAME } from "./config/app";
import {
  ProtectedUnauthenticated,
  ProtectedStudioAuth,
  ProtectedMemberAuth,
  ProtectedMemberLogin,
} from "./lib/RouteGuards";
import { AppLayout } from "./components/AppLayout";
import { Page, PageHeader, Card } from "./components/ui/index";
import RoleGateway from "./pages/RoleGateway";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import StudioSelector from "./pages/StudioSelector";
import CreateStudio from "./pages/CreateStudio";
import Dashboard from "./pages/dashboard/DashboardPage";
import MemberLogin from "./pages/MemberLogin";
import Members from "./pages/Members";
import PersonalAccounts from "./pages/PersonalAccounts";
import CreateFirstPersonalAccount from "./pages/CreateFirstPersonalAccount";
import PersonalAccountLogin from "./pages/PersonalAccountLogin";
import { GameControl } from "./pages/GameControl";
import Games from "./pages/Games";
import Settings from "./pages/Settings";
import TriolithAdminPage from "./pages/admin/TriolithAdminPage";
import PlayerPortal from "./player/PlayerPortal";
import { ROUTES } from "./routes";
import "./index.css";

function NotFound() {
  return (
    <Page>
      <PageHeader title="404 - Page not found" />
      <Card>
        <p>Current URL: {window.location.pathname}</p>
        <a
          href={ROUTES.login}
          style={{ color: "var(--primary)", textDecoration: "underline" }}>
          Go to login
        </a>
      </Card>
    </Page>
  );
}

function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    console.log("Route render", location.pathname);
  }, [location]);

  return (
    <Routes>
      {/* Public routes (no layout) */}
      <Route path={ROUTES.root} element={<RoleGateway />} />
      <Route path={ROUTES.login} element={<Login />} />
      <Route path="/player/*" element={<PlayerPortal />} />
      <Route
        path={ROUTES.signup}
        element={
          <ProtectedUnauthenticated>
            <Signup />
          </ProtectedUnauthenticated>
        }
      />
      <Route
        path={ROUTES.createStudio}
        element={
          <ProtectedUnauthenticated>
            <CreateStudio />
          </ProtectedUnauthenticated>
        }
      />
      <Route
        path={ROUTES.memberLogin}
        element={
          <ProtectedMemberLogin>
            <MemberLogin />
          </ProtectedMemberLogin>
        }
      />

      {/* Routes with layout */}
      <Route element={<AppLayout />}>
        <Route
          path={ROUTES.dashboard}
          element={
            <ProtectedStudioAuth>
              <Dashboard />
            </ProtectedStudioAuth>
          }
        />
        <Route
          path={ROUTES.studios}
          element={
            <ProtectedStudioAuth>
              <StudioSelector />
            </ProtectedStudioAuth>
          }
        />

        {/* Stubs / member-level pages referenced by header */}
        <Route
          path={ROUTES.members}
          element={
            <ProtectedMemberAuth>
              <Members />
            </ProtectedMemberAuth>
          }
        />
        <Route
          path={ROUTES.games}
          element={
            <ProtectedMemberAuth>
              <Games />
            </ProtectedMemberAuth>
          }
        />
        <Route
          path={ROUTES.settings}
          element={
            <ProtectedMemberAuth>
              <Settings />
            </ProtectedMemberAuth>
          }
        />

        <Route
          path="/home"
          element={<Navigate to={ROUTES.dashboard} replace />}
        />
        <Route
          path="/create-first-account"
          element={
            <ProtectedMemberAuth>
              <CreateFirstPersonalAccount />
            </ProtectedMemberAuth>
          }
        />
        <Route
          path="/account-login"
          element={
            <ProtectedMemberAuth>
              <PersonalAccountLogin />
            </ProtectedMemberAuth>
          }
        />
        <Route
          path="/personal-accounts"
          element={
            <ProtectedMemberAuth>
              <PersonalAccounts />
            </ProtectedMemberAuth>
          }
        />
        <Route
          path="/game/:gameId"
          element={
            <ProtectedMemberAuth>
              <GameControl />
            </ProtectedMemberAuth>
          }
        />
        <Route
          path={ROUTES.triolithAdmin}
          element={
            <ProtectedMemberAuth>
              <TriolithAdminPage />
            </ProtectedMemberAuth>
          }
        />
      </Route>

      {/* Global NotFound last */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  useDocumentTitle(APP_NAME);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) setAuthToken(token);
  }, []);

  return (
    <BrowserRouter>
      <LanguageProvider>
        <LanguageToggle />
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
