"use client";

import type { ReactNode } from "react";

export function HoursOpenButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-hours-modal"))}
      className={className}
    >
      {children}
    </button>
  );
}
