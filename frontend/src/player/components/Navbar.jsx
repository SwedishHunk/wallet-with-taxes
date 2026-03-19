import { NavLink, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, ArrowLeftRight, Briefcase, Settings, Receipt, ShoppingBag } from "lucide-react";
import ConnectWallet from "./ConnectWallet";
import { useWallet } from "../context/WalletContext";
import { useLanguage } from "../../lib/LanguageContext";

export default function Navbar() {
  const { isAdmin } = useWallet();
  const { t } = useLanguage();
  const location = useLocation();
  const gameIdMatch = location.pathname.match(/\/game\/([^/]+)/);
  const gameId = gameIdMatch?.[1] ?? null;
  const base = gameId ? `/player/game/${gameId}` : "/player";

  const navItems = [
    { to: `${base}`, label: t("player.nav.dashboard"), icon: LayoutDashboard },
    { to: `${base}/trade`, label: t("player.nav.trade"), icon: ArrowLeftRight },
    { to: `${base}/portfolio`, label: t("player.nav.portfolio"), icon: Briefcase },
    ...(gameId
      ? [{ to: `${base}/shop`, label: t("player.nav.shop") || "Shop", icon: ShoppingBag }]
      : []),
    { to: `${base}/tax`, label: t("player.nav.tax"), icon: Receipt },
  ];

  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(8, 12, 24, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
        position: 'relative',
      }}
    >
      {/* Animated gradient glow line */}
      <div
        style={{
          position: 'absolute',
          bottom: -1,
          left: 0,
          right: 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent 0%, rgba(0, 212, 255, 0.4) 20%, rgba(168, 85, 247, 0.4) 50%, rgba(0, 212, 255, 0.4) 80%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'gradientShift 4s ease infinite',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo — links to landing page */}
          <Link to="/" className="player-logo-link">
            <div className="logo-triangle-wrap">
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                <defs>
                  <linearGradient id="triStrokeP" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00d4ff" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                  <linearGradient id="triStroke2P" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#00d4ff" />
                  </linearGradient>
                </defs>
                <polygon points="17,6 30,28 4,28" stroke="rgba(168,85,247,0.22)" strokeWidth="1.5" transform="translate(1.2,1.2)" />
                <polygon points="17,6 30,28 4,28" stroke="url(#triStrokeP)" strokeWidth="2.2" />
                <polygon points="17,12 25.5,26 8.5,26" stroke="url(#triStroke2P)" strokeWidth="1.1" opacity="0.6" />
                <circle cx="17" cy="21" r="1.6" fill="#00d4ff" opacity="0.85" />
              </svg>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span>Triolith</span>
              <span className="header-logo-sub">{t("player.logo.sub")}</span>
            </div>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-1">
            {gameId && (
              <NavLink
                to="/player/trade"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-dark-700"
              >
                Global
              </NavLink>
            )}
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-white"
                      : "text-gray-400 hover:text-white"
                  }`
                }
                style={({ isActive }) => isActive ? {
                  background: 'rgba(0, 212, 255, 0.08)',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                  boxShadow: '0 0 15px rgba(0, 212, 255, 0.1)',
                  color: '#00d4ff',
                } : {}}
                end={to === "/player"}
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}

            {isAdmin && (
              <NavLink
                to={`${base}/admin`}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "text-white"
                      : "text-gray-400 hover:text-purple-400"
                  }`
                }
                style={({ isActive }) => isActive ? {
                  background: 'rgba(168, 85, 247, 0.1)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  boxShadow: '0 0 15px rgba(168, 85, 247, 0.1)',
                  color: '#a855f7',
                } : {}}
              >
                <Settings size={16} />
                {t("player.nav.admin")}
              </NavLink>
            )}
          </div>

          {/* Wallet */}
          <ConnectWallet />
        </div>
      </div>
    </nav>
  );
}
