"use client";

type Props = {
  label: string;
};

export function StaffLogoutButton({ label }: Props) {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/staff-auth/logout", { method: "POST" });
        window.location.reload();
      }}
      className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black"
    >
      {label}
    </button>
  );
}

