"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

const fmt = (n, prefix) => {
  const s = Math.round(Math.abs(n)).toLocaleString("en-PK");
  return `${n < 0 ? "−" : ""}${prefix}${s}`;
};

/** Counts up to `value` when it scrolls into view ("Rs " prefix for money). Final value is server-rendered. */
export function CountUp({ value, prefix = "", duration = 0.9 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!inView || reduce || !ref.current) return;
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = fmt(v, prefix);
      },
    });
    return () => controls.stop();
  }, [inView, value, reduce, prefix, duration]);

  return <span ref={ref}>{fmt(value, prefix)}</span>;
}
