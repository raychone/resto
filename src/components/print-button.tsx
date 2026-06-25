"use client";

type Props = {
  label?: string;
  className?: string;
};

export function PrintButton({ label = "Imprimer", className }: Props) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      {label}
    </button>
  );
}
