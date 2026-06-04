import { motion, useReducedMotion } from "framer-motion";

/**
 * Scroll-triggered entrance: fade + rise, fires once when in view.
 * Honors prefers-reduced-motion (renders static).
 */
export default function Reveal({
  children,
  delay = 0,
  y = 20,
  className = "",
  as = "div",
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] ?? motion.div;

  return (
    <MotionTag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </MotionTag>
  );
}
