import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { staggerContainer, fadeInUp, scalePop } from "../lib/motionPresets";
import CyberpunkScene from "../components/3d/SafeCyberpunkScene";
import FilmGrainOverlay from "../components/3d/FilmGrainOverlay";
import "./RoleGateway.css";

const cardHoverPlayer = {
  y: -8,
  scale: 1.02,
  borderColor: "rgba(0, 212, 255, 0.35)",
  boxShadow:
    "0 24px 80px rgba(0, 0, 0, 0.4), 0 0 40px rgba(0, 212, 255, 0.1), inset 0 1px 0 rgba(0, 212, 255, 0.1)",
  transition: { type: "spring", stiffness: 300, damping: 20 },
};

const cardHoverOwner = {
  y: -8,
  scale: 1.02,
  borderColor: "rgba(168, 85, 247, 0.35)",
  boxShadow:
    "0 24px 80px rgba(0, 0, 0, 0.4), 0 0 40px rgba(168, 85, 247, 0.1), inset 0 1px 0 rgba(168, 85, 247, 0.1)",
  transition: { type: "spring", stiffness: 300, damping: 20 },
};

export default function RoleGateway() {
  return (
    <div className="role-gateway">
      <CyberpunkScene intensity="full" />
      <FilmGrainOverlay />
      <div className="role-gateway__backdrop" />
      <motion.div
        className="role-gateway__panel"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
        <motion.div className="role-gateway__eyebrow" variants={fadeInUp}>
          Triolith Access Point
        </motion.div>

        <motion.h1
          className="role-gateway__title"
          variants={fadeInUp}
        >
          Välj hur du vill gå in i systemet
        </motion.h1>

        <motion.p className="role-gateway__intro" variants={fadeInUp}>
          Player-flödet går till TokenShop, trading och portfolio. Spelägare går
          till studio-, medlem- och plattformsdelen.
        </motion.p>

        <motion.div className="role-gateway__choices" variants={staggerContainer}>
          <motion.div variants={scalePop}>
            <Link className="role-card role-card--player" to="/player">
              <motion.span
                className="role-card__label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Player
              </motion.span>
              <span className="role-card__headline">Handla TRI och följ portfolio</span>
              <span className="role-card__body">
                Dashboard, trade, tax och wallet-koppling i samma frontend.
              </span>
            </Link>
          </motion.div>

          <motion.div variants={scalePop}>
            <Link className="role-card role-card--owner" to="/login">
              <motion.span
                className="role-card__label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                Spelägare
              </motion.span>
              <span className="role-card__headline">
                Logga in till studio- och kontrollpanelen
              </span>
              <span className="role-card__body">
                Studio-login, members, games, settings och owner-styrning.
              </span>
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
