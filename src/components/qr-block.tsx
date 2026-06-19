"use client";

import { QRCodeSVG } from "qrcode.react";

export function QrBlock({ value, logoUrl }: { value: string; logoUrl?: string }) {
  return (
    <div className="w-full rounded-[2rem] border border-[#eadfce] bg-gradient-to-b from-white to-[#faf3ea] p-4 shadow-[0_20px_60px_rgba(70,35,22,0.12)] print:w-[15cm] print:max-w-none print:p-0 print:shadow-none">
      <div className="relative mx-auto flex aspect-square w-[min(82vw,22rem)] items-center justify-center rounded-[2rem] border border-[#eadfce] bg-white p-3 shadow-[0_14px_36px_rgba(70,35,22,0.08)] print:w-[15cm] print:max-w-none print:shadow-none">
        <QRCodeSVG
          value={value}
          size={280}
          level="H"
          includeMargin
          bgColor="#ffffff"
          fgColor="#111111"
          className="h-full w-full"
        />
        {logoUrl ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <img
              src={logoUrl}
              alt=""
              className="h-20 w-20 rounded-[1.2rem] border border-[#eadfce] bg-white object-cover shadow-[0_10px_30px_rgba(70,35,22,0.12)] print:h-16 print:w-16"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
