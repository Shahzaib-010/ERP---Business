"use client";

import { motion, useReducedMotion } from "motion/react";

const STEPS = [
  { n: "01", title: "Explore", text: "Browse the models and try every colour online in the 3D showroom." },
  { n: "02", title: "Visit", text: "Come to the Auto Market and see the bikes in person." },
  { n: "03", title: "Choose", text: "Pick the model and colour that suit you, new or used." },
  { n: "04", title: "Ride", text: "Take your new motorcycle home." },
];

// A gently rising route line with a marker at each step (x = 12.5%, 37.5%, 62.5%, 87.5%).
const PATH = "M0 150 C 60 150 80 120 125 118 S 210 140 260 110 S 330 60 375 72 S 450 120 500 96 S 580 40 625 46 S 720 80 770 52 S 860 20 1000 26";
const MARKERS = [
  { x: 125, y: 118 },
  { x: 375, y: 72 },
  { x: 625, y: 46 },
  { x: 875, y: 34 },
];

export function RideTimeline() {
  const reduce = useReducedMotion();
  return (
    <div>
      <div className="relative -mx-5 sm:-mx-8">
        <svg viewBox="0 0 1000 180" preserveAspectRatio="none" className="h-36 w-full sm:h-44" aria-hidden="true">
          {[40, 80, 120, 160].map((y) => (
            <line key={y} x1="0" x2="1000" y1={y} y2={y} stroke="white" strokeOpacity="0.06" />
          ))}
          <motion.path
            d={PATH}
            fill="none"
            stroke="var(--brand)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            initial={reduce ? false : { pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.8, ease: [0.65, 0, 0.35, 1] }}
          />
          {MARKERS.map((m, i) => (
            <g key={i}>
              <line x1={m.x} x2={m.x} y1={m.y} y2="180" stroke="white" strokeOpacity="0.12" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
              <motion.circle
                cx={m.x}
                cy={m.y}
                r="5"
                fill="var(--brand)"
                initial={reduce ? false : { opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 + i * 0.35, duration: 0.3 }}
              />
            </g>
          ))}
        </svg>
      </div>

      <ol className="grid border-t border-white/10 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li
            key={s.n}
            className={`border-b border-white/10 p-6 sm:border-r lg:border-b-0 ${i === 0 ? "bg-white/[0.04]" : ""} ${i === STEPS.length - 1 ? "lg:border-r-0" : ""}`}
          >
            <p className="font-condensed text-sm font-semibold tracking-[0.2em] text-brand">{s.n}</p>
            <p className="mt-3 text-lg font-semibold text-white">{s.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-white/55">{s.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
