"use client";

import type { ReactNode } from "react";

export function BookingOpenButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("open-booking-modal"))}
      className={className}
    >
      {children}
    </button>
  );
}
