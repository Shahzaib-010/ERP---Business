"use client";

import { useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CheckIcon, Hand, PauseIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SHOWROOM_MODELS } from "@/lib/showroom";
import { cn } from "@/lib/utils";

// three.js only runs in the browser.
const BikeCanvas = dynamic(() => import("./bike-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Skeleton className="h-2/3 w-3/4 rounded-3xl" />
    </div>
  ),
});

function subscribeMotion(cb) {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

function useReducedMotionPref() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Light or dark text for a swatch colour. */
function isLight(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

export function Showroom() {
  const reduceMotion = useReducedMotionPref();
  const requested = useSearchParams().get("model");
  const [modelId, setModelId] = useState(
    SHOWROOM_MODELS.some((m) => m.id === requested) ? requested : SHOWROOM_MODELS[0].id,
  );
  const [colorByModel, setColorByModel] = useState({});
  const [userSpin, setUserSpin] = useState(null); // null = follow the default
  const [resetKey, setResetKey] = useState(0);

  const model = SHOWROOM_MODELS.find((m) => m.id === modelId);
  const color = model.colors[colorByModel[modelId] ?? 0];
  const autoRotate = userSpin ?? !reduceMotion;

  const chooseModel = (id) => {
    setModelId(id);
    document.getElementById("showroom")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  return (
    <>
      <section id="showroom" className="relative scroll-mt-16 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10 transition-[background] duration-700"
          style={{
            background: `radial-gradient(55rem 30rem at 70% 35%, color-mix(in oklch, ${color.hex} 22%, transparent), transparent 70%)`,
          }}
        />
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 pt-6 pb-12 sm:px-8 lg:grid-cols-[1fr_1.35fr] lg:items-center lg:gap-4 lg:pt-10">
          {/* Text and controls */}
          <div className="order-2 flex flex-col gap-7 lg:order-1">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Models">
              {SHOWROOM_MODELS.map((m) => (
                <button
                  key={m.id}
                  role="tab"
                  aria-selected={m.id === modelId}
                  onClick={() => setModelId(m.id)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
                    m.id === modelId
                      ? "border-foreground bg-foreground text-background shadow-sm"
                      : "bg-background/60 text-muted-foreground backdrop-blur hover:border-foreground/40 hover:text-foreground",
                  )}
                >
                  {m.name}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={model.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-4"
              >
                <h1 className="font-bold text-6xl tracking-tight sm:text-7xl">{model.name}</h1>
                <p className="max-w-md text-lg text-muted-foreground">{model.tagline}</p>
                <dl className="grid max-w-md grid-cols-2 gap-3 sm:grid-cols-4">
                  {model.specs.map((s) => (
                    <div key={s.label} className="rounded-xl border bg-background/70 px-3 py-2.5 backdrop-blur">
                      <dt className="text-xs text-muted-foreground">{s.label}</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </motion.div>
            </AnimatePresence>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Colour: <span className="font-medium text-foreground">{color.name}</span>
              </p>
              <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Colour">
                {model.colors.map((c, i) => {
                  const selected = c.hex === color.hex;
                  return (
                    <Tooltip key={c.hex}>
                      <TooltipTrigger asChild>
                        <button
                          role="radio"
                          aria-checked={selected}
                          aria-label={c.name}
                          onClick={() => setColorByModel((prev) => ({ ...prev, [modelId]: i }))}
                          className={cn(
                            "relative flex size-11 items-center justify-center rounded-full border-2 shadow-sm transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                            selected ? "scale-110 border-foreground" : "border-background ring-1 ring-border",
                          )}
                          style={{ background: `radial-gradient(circle at 30% 30%, color-mix(in oklch, ${c.hex} 70%, white), ${c.hex} 60%)` }}
                        >
                          {selected && <CheckIcon className={cn("size-4", isLight(c.hex) ? "text-black" : "text-white")} />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{c.name}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="h-11 rounded-full px-5" asChild>
                <Link href="/#visit">Visit the showroom</Link>
              </Button>
              <Button size="lg" variant="outline" className="h-11 rounded-full bg-background/60 px-5 backdrop-blur" asChild>
                <a href="#models">Compare models</a>
              </Button>
            </div>
          </div>

          {/* 3D viewer */}
          <div className="relative order-1 lg:order-2">
            <div className="relative aspect-[4/3] w-full sm:aspect-[16/11]">
              <BikeCanvas
                color={color.hex}
                style={model.style}
                autoRotate={autoRotate}
                resetKey={resetKey}
                onInteract={() => setUserSpin(false)}
              />
            </div>
            <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-xs backdrop-blur">
                <Hand className="size-3.5" /> Drag to rotate<span className="hidden sm:inline"> · scroll to zoom</span>
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="rounded-full bg-background/80 backdrop-blur"
                    onClick={() => setUserSpin(!autoRotate)}
                    aria-label={autoRotate ? "Stop rotating" : "Rotate automatically"}
                  >
                    {autoRotate ? <PauseIcon /> : <PlayIcon />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{autoRotate ? "Stop rotating" : "Rotate automatically"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="rounded-full bg-background/80 backdrop-blur"
                    onClick={() => setResetKey((k) => k + 1)}
                    aria-label="Reset view"
                  >
                    <RotateCcwIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset view</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </section>

      {/* Model line-up */}
      <section id="models" className="scroll-mt-16 border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <div className="mb-10 max-w-2xl">
            <p className="text-[0.7rem] tracking-[0.2em] text-muted-foreground uppercase">The line-up</p>
            <h2 className="font-bold mt-3 text-4xl tracking-tight sm:text-5xl">Find the bike that fits you</h2>
            <p className="mt-3 text-muted-foreground">Pick a model to see it in 3D, then try every colour.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {SHOWROOM_MODELS.map((m, idx) => {
              const shown = m.colors[colorByModel[m.id] ?? 0];
              return (
                <motion.button
                  key={m.id}
                  type="button"
                  onClick={() => chooseModel(m.id)}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.4, delay: idx * 0.08 }}
                  className={cn(
                    "group flex flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-xs transition-all hover:-translate-y-1 hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    m.id === modelId && "ring-2 ring-foreground",
                  )}
                >
                  <div
                    className="relative flex h-40 items-end justify-between p-5"
                    style={{ background: `linear-gradient(135deg, color-mix(in oklch, ${shown.hex} 85%, black), color-mix(in oklch, ${shown.hex} 55%, white))` }}
                  >
                    <span className={cn("font-bold text-4xl tracking-tight", isLight(shown.hex) ? "text-black/80" : "text-white")}>{m.name}</span>
                    <span className="flex -space-x-1.5">
                      {m.colors.map((c) => (
                        <span key={c.hex} className="size-5 rounded-full border-2 border-white/80" style={{ background: c.hex }} />
                      ))}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <p className="text-sm text-muted-foreground">{m.tagline}</p>
                    <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {m.specs.map((s) => (
                        <div key={s.label} className="flex justify-between gap-2 border-b pb-1.5">
                          <dt className="text-muted-foreground">{s.label}</dt>
                          <dd className="font-medium tabular-nums">{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <span className="text-sm font-medium underline decoration-brand decoration-2 underline-offset-4">View in 3D →</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
