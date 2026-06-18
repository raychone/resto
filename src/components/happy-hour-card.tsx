"use client";

import { useEffect, useMemo, useState } from "react";

type HappyHourState = {
  active: boolean;
  label: string;
  message: string;
  targetAt: string;
};

function formatCountdown(milliseconds: number) {
  const safeMs = Math.max(0, milliseconds);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function HappyHourCard({
  happyHour,
  accent,
}: {
  happyHour: HappyHourState;
  accent: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = useMemo(() => {
    const targetAt = new Date(happyHour.targetAt).getTime();
    return formatCountdown(targetAt - now);
  }, [happyHour.targetAt, now]);

  return (
    <div
      className="rounded-[1.75rem] border border-white/10 px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
      style={{
        backgroundImage: `linear-gradient(135deg, #171717 0%, #111111 55%, ${accent}1f 100%)`,
        boxShadow: `0 20px 50px ${accent}1f`,
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/35">
            {happyHour.label}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#f5f1ea] sm:text-base">
            {happyHour.active ? "Open" : "Starts in"}
          </p>
          <p
            className="mt-1 font-mono text-[1.12rem] font-semibold tracking-[0.2em] text-white tabular-nums sm:text-[1.22rem]"
            suppressHydrationWarning
          >
            {countdown}
          </p>
        </div>

        <div
          className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.25)]"
          style={{ backgroundColor: `${accent}d9` }}
        >
          {happyHour.active ? "OPEN" : "SOON"}
        </div>
      </div>

    </div>
  );
}
