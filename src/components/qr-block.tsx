"use client";

import { QRCodeSVG } from "qrcode.react";

export function QrBlock({ value, logoUrl }: { value: string; logoUrl?: string }) {
  return (
    <div className="rounded-[2rem] border border-black/8 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      {logoUrl ? (
        <div className="mb-4 flex items-center justify-center">
          <img
            src={logoUrl}
            alt=""
            className="h-28 w-28 rounded-[1.75rem] object-cover shadow-[0_14px_40px_rgba(15,23,42,0.12)]"
          />
        </div>
      ) : null}

      <div className="relative mx-auto flex w-fit items-center justify-center rounded-[2rem] bg-white p-0">
        <QRCodeSVG
          value={value}
          size={320}
          level="H"
          includeMargin
          bgColor="#ffffff"
          fgColor="#111111"
          className="h-auto w-full"
        />
        {logoUrl ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <img
              src={logoUrl}
              alt=""
              className="h-24 w-24 rounded-[1.5rem] border border-black/10 bg-black/5 object-cover shadow-[0_10px_30px_rgba(15,23,42,0.15)]"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
