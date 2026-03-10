/**
 * Shared Framer Motion animation presets
 * Used across both studio and player portal
 */

// === Page-level transitions ===
export const pageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.2 },
  },
} as const;

// === Stagger container ===
export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
} as const;

// === Card entrance ===
export const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 25,
    },
  },
};

// === Fade in up (general purpose) ===
export const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

// === Fade in (simple) ===
export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4 },
  },
};

// === Slide in from left ===
export const slideInLeft = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

// === Slide in from right ===
export const slideInRight = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

// === Scale pop ===
export const scalePop = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 400, damping: 25 },
  },
};

// === Hover/tap presets for interactive elements ===
export const hoverScale = {
  whileHover: { scale: 1.03, transition: { type: "spring" as const, stiffness: 400, damping: 17 } },
  whileTap: { scale: 0.97 },
};

export const hoverLift = {
  whileHover: { y: -4, transition: { type: "spring" as const, stiffness: 400, damping: 17 } },
  whileTap: { y: 0, scale: 0.98 },
};

export const hoverGlow = {
  whileHover: {
    boxShadow: "0 0 30px rgba(0, 212, 255, 0.15), 0 8px 32px rgba(0, 0, 0, 0.3)",
    borderColor: "rgba(0, 212, 255, 0.25)",
    transition: { duration: 0.3 },
  },
};

// === List item with stagger ===
export const listItem = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 28 },
  },
};

// === Badge pop in ===
export const badgePop = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 500, damping: 25 },
  },
};
