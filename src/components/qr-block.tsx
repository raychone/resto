"use client";

import { QRCodeSVG } from "qrcode.react";

export function QrBlock({ value }: { value: string }) {
  return (
    <div className="rounded-[2rem] border border-black/8 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <QRCodeSVG
        value={value}
        size={280}
        level="M"
        includeMargin
        bgColor="#ffffff"
        fgColor="#111111"
        className="h-auto w-full"
      />
    </div>
  );
}

