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
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import StudioSelector from "./pages/StudioSelector";
import CreateStudio from "./pages/CreateStudio";
import Dashboard from "./pages/dashboard/index_dash";
import MemberLogin from "./pages/MemberLogin";
import Members from "./pages/Members";
import PersonalAccounts from "./pages/PersonalAccounts";
import HomePage from "./pages/HomePage";
import CreateFirstPersonalAccount from "./pages/CreateFirstPersonalAccount";
import PersonalAccountLogin from "./pages/PersonalAccountLogin";
import { GameControl } from "./pages/GameControl";
import { ROUTES } from "./routes";
import "./index.css";

function NotFound() {
  return (
    <Page>
      <PageHeader title="404 - Rutt inte hittad" />
      <Card>
        <p>Aktuell URL: {window.location.pathname}</p>
        <a
          href={ROUTES.login}
          style={{ color: "var(--primary)", textDecoration: "underline" }}>
          Gå till inloggning
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
      <Route path={ROUTES.root} element={<Login />} />
      <Route path={ROUTES.login} element={<Login />} />
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
              <Page>
                <PageHeader title="Games" />
                <Card>TODO: Games page</Card>
              </Page>
            </ProtectedMemberAuth>
          }
        />
        <Route
          path={ROUTES.settings}
          element={
            <ProtectedMemberAuth>
              <Page>
                <PageHeader title="Inställningar" />
                <Card>TODO: Settings page</Card>
              </Page>
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
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
