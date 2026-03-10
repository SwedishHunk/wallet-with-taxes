import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import CyberpunkScene from "../../components/3d/SafeCyberpunkScene";
import FilmGrainOverlay from "../../components/3d/FilmGrainOverlay";

const pageTransition = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2 },
  },
};

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen relative" style={{ background: 'linear-gradient(135deg, #050810 0%, #0a0e1a 40%, #0d1225 100%)' }}>
      <CyberpunkScene intensity="subtle" sacredGeometry="metatron" />
      <FilmGrainOverlay />
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative"
          style={{ zIndex: 1 }}
          {...pageTransition}
        >
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}