"use client";

type Props = {
  endpoint: string;
  label: string;
  redirectTo?: string;
};

export function DashboardLogoutButton({ endpoint, label, redirectTo = "/" }: Props) {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch(endpoint, { method: "POST" });
        window.location.href = redirectTo;
      }}
      className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black"
    >
      {label}
    </button>
  );
}
