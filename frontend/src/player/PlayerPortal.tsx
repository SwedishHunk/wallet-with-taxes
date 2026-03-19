import { Routes, Route, Navigate } from "react-router-dom";
import { WalletProvider } from "./context/WalletContext";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Trade from "./pages/Trade";
import Portfolio from "./pages/Portfolio";
import Market from "./pages/Market";
import TaxReport from "./pages/TaxReport";
import Admin from "./pages/Admin";
import "./index.css";

export default function PlayerPortal() {
  return (
    <WalletProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/game/:gameId" element={<Dashboard />} />
          <Route path="/trade" element={<Trade />} />
          <Route path="/game/:gameId/trade" element={<Trade />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/game/:gameId/portfolio" element={<Portfolio />} />
          <Route path="/game/:gameId/market" element={<Market />} />
          <Route path="/tax" element={<TaxReport />} />
          <Route path="/game/:gameId/tax" element={<TaxReport />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/game/:gameId/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/player" replace />} />
        </Routes>
      </Layout>
    </WalletProvider>
  );
}
