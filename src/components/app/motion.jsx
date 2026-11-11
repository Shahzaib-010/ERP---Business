"use client";

import { motion, useReducedMotion } from "motion/react";

// Small, consistent entrance animations. They respect "reduce motion" settings.

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
};

/** Children wrapped in <StaggerItem> appear one after another. */
export function Stagger({ className, children }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={container} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

export function StaggerItem({ className, children }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}
