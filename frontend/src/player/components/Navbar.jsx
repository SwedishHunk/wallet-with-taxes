import { NavLink } from "react-router-dom";
import { LayoutDashboard, ArrowLeftRight, Briefcase, Settings, Receipt } from "lucide-react";
import ConnectWallet from "./ConnectWallet";
import { useWallet } from "../context/WalletContext";

const navItems = [
  { to: "/player", label: "Dashboard", icon: LayoutDashboard },
  { to: "/player/trade", label: "Trade", icon: ArrowLeftRight },
  { to: "/player/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/player/tax", label: "Tax", icon: Receipt },
];

export default function Navbar() {
  const { isAdmin } = useWallet();

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
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #00d4ff 0%, #a855f7 100%)',
                boxShadow: '0 0 15px rgba(0, 212, 255, 0.3)',
              }}
            >
              <span className="text-white font-bold text-sm" style={{ fontFamily: '"Orbitron", sans-serif' }}>T</span>
            </div>
            <span className="font-bold text-lg tracking-tight">
              <span className="glow-text-cyan" style={{ fontFamily: '"Orbitron", "Inter", sans-serif', letterSpacing: '0.04em' }}>Triolith</span>
              <span className="text-gray-500 ml-1.5 text-sm font-normal">Player</span>
            </span>
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-1">
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
                to="/player/admin"
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
                Admin
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
