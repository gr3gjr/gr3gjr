"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

const ENTRIES = [
  { text: "Primeiro registro. Sem contexto.", date: "21/12/2025" },
  { text: "Algumas coisas não precisam ser explicadas.", date: "18/12/2025" },
  { text: "Guardar também é criar.", date: "10/12/2025" },
  { text: "O tempo organiza melhor do que a gente.", date: "02/12/2025" },
  { text: "Isso aqui é um arquivo.", date: "20/11/2025" },
];

export default function Home() {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Measures the height of ONE timeline block (A)
  const blockMeasureRef = useRef<HTMLDivElement | null>(null);

  // Real scrollTop (can jump because of looping)
  const lastRealTopRef = useRef(0);

  // Virtual scroll (never jumps; drives header morph)
  const virtualYRef = useRef(0);

  const [virtualY, setVirtualY] = useState(0);
  const [vh, setVh] = useState(0);
  const [blockH, setBlockH] = useState(0);

  // Enables the infinite loop only after user starts scrolling into content
  const loopArmedRef = useRef(false);

  // RAF batching for smoother state updates
  const rafRef = useRef<number | null>(null);

  // viewport height
  useEffect(() => {
    const update = () => setVh(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // measure one block height
  useEffect(() => {
    const el = blockMeasureRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setBlockH(rect.height);
    };

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    // On first mount: start at the very top (so only the title shows)
    scroller.scrollTop = 0;
    lastRealTopRef.current = 0;
    virtualYRef.current = 0;
    setVirtualY(0);
    loopArmedRef.current = false;

    const introH = scroller.clientHeight; // first-screen spacer height
    const buffer = 260; // safe zone for seamless jump (tweak if needed)

    const scheduleVirtualUpdate = () => {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        setVirtualY(virtualYRef.current);
      });
    };

    const onScroll = () => {
      const top = scroller.scrollTop;
      const prevTop = lastRealTopRef.current;
      let delta = top - prevTop;

      // Arm the loop once user actually reaches the timeline area
      // (after leaving the first-screen title view)
      if (!loopArmedRef.current && top > introH * 0.6) {
        loopArmedRef.current = true;

        // When we arm, we silently move the user into the MIDDLE block
        // so they never hit a "real end".
        if (blockH > 0) {
          // Jump down by one block to land in the middle copy
          scroller.scrollTop = top + blockH;

          // Keep virtual scroll continuous (ignore this teleport)
          lastRealTopRef.current = scroller.scrollTop;

          // No virtual update needed from this artificial move
          return;
        }
      }

      // Update virtual scroll (continuous)
      // If a loop jump happens later, delta will be huge; we'll correct it.
      if (loopArmedRef.current && blockH > 0) {
        // If delta is suspiciously large, it was likely a teleport of ~blockH.
        // We adjust delta so virtual scroll stays smooth.
        if (Math.abs(delta) > blockH * 0.5) {
          // Determine direction:
          // If we jumped down, delta is positive huge; subtract blockH.
          // If we jumped up, delta is negative huge; add blockH.
          delta = delta > 0 ? delta - blockH : delta + blockH;
        }
      }

      virtualYRef.current += delta;
      scheduleVirtualUpdate();

      lastRealTopRef.current = top;

      // Loop logic (only after armed)
      if (!loopArmedRef.current || blockH <= 0) return;

      // We render 3 blocks: A + A + A.
      // After arming, we want the user to stay around the middle A (block 2).
      // The timeline starts after the intro spacer.
      const block1Start = introH;
      const block2Start = introH + blockH;
      const block3Start = introH + blockH * 2;

      // If user goes too close to the top zone (block 1), jump down one block
      if (top < block1Start + buffer) {
        scroller.scrollTop = top + blockH;
        lastRealTopRef.current = scroller.scrollTop; // prevent weird delta on next tick
        return;
      }

      // If user goes too close to the bottom zone (block 3), jump up one block
      if (top > block3Start - buffer) {
        scroller.scrollTop = top - blockH;
        lastRealTopRef.current = scroller.scrollTop;
        return;
      }
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [blockH]);

  // Reveal timeline only after user has actually scrolled a little (virtual)
  const isRevealed = virtualY > 12;

  /**
   * Header morph (driven by virtual scroll, never jumps)
   */
  const start = 140;
  const end = 360;

  const progress = useMemo(() => {
    return clamp((virtualY - start) / (end - start), 0, 1);
  }, [virtualY]);

  const headerHeight = 64;
  const headerTopInset = 12;
  const headerCenterY = headerTopInset + headerHeight / 2;

  const viewportH = vh || 800;
  const screenCenterY = viewportH / 2;

  const deltaToHeader = screenCenterY - headerCenterY;
  const translateY = -deltaToHeader * progress;
  const scale = 1 - progress * 0.6;

  const headerClearance = headerTopInset + headerHeight + 24;

  return (
    <div className="relative h-dvh bg-black text-white">
      {/* Header backing */}
      <div
        className="pointer-events-none fixed left-0 right-0 top-0 z-30"
        style={{ height: headerTopInset + headerHeight }}
      >
        <div
          className="absolute inset-0"
          style={{
            opacity: progress,
            backdropFilter: "blur(10px)",
            background: "rgba(0,0,0,0.35)",
            transition: "opacity 180ms ease",
          }}
        />
      </div>

      {/* Morphing title */}
      <div
        className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
        style={{
          transform: `translateY(${translateY}px) scale(${scale})`,
          transformOrigin: "center",
          willChange: "transform",
        }}
      >
        <h1 className="select-none text-6xl tracking-tight sm:text-7xl">
          gr3gjr
        </h1>
      </div>

      {/* Scroll container */}
      <div ref={scrollerRef} className="relative z-10 h-dvh overflow-y-auto">
        {/* First screen: only title */}
        <div className="h-dvh" />

        {/* Timeline wrapper */}
        <div
          className={isRevealed ? "opacity-100" : "opacity-0"}
          style={{
            transition: "opacity 220ms ease",
            paddingTop: headerClearance,
          }}
        >
          <div className="mx-auto max-w-2xl px-6 pb-32">
            {/* Block 1 */}
            <div className="space-y-24">
              {ENTRIES.map((e, i) => (
                <Entry key={`b1-${e.date}-${i}`} text={e.text} date={e.date} />
              ))}
            </div>

            {/* Block 2 (measured) */}
            <div ref={blockMeasureRef} className="space-y-24">
              {ENTRIES.map((e, i) => (
                <Entry key={`b2-${e.date}-${i}`} text={e.text} date={e.date} />
              ))}
            </div>

            {/* Block 3 */}
            <div className="space-y-24">
              {ENTRIES.map((e, i) => (
                <Entry key={`b3-${e.date}-${i}`} text={e.text} date={e.date} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Vignette */}
      <div className="pointer-events-none fixed inset-0 z-50 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.35)_65%,rgba(0,0,0,0.75)_100%)]" />
    </div>
  );
}

function Entry({ text, date }: { text: string; date: string }) {
  return (
    <article className="space-y-3">
      <p className="text-lg leading-relaxed text-white/90">{text}</p>
      <span className="block text-sm text-white/40">{date}</span>
    </article>
  );
}