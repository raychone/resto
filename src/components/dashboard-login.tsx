"use client";

import { useState, type FormEvent } from "react";

type Props = {
  title: string;
  description: string;
  defaultUsername: string;
  defaultPassword: string;
  endpoint: string;
};

export function DashboardLogin({
  title,
  description,
  defaultUsername,
  defaultPassword,
  endpoint,
}: Props) {
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState(defaultPassword);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      setError("Identifiants invalides.");
      setLoading(false);
      return;
    }

    window.location.reload();
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center px-4">
      <section className="w-full max-w-md rounded-[2rem] border border-black/8 bg-white/90 p-6 shadow-[0_24px_90px_rgba(15,23,42,0.1)] backdrop-blur">
        <p className="text-[11px] uppercase tracking-[0.35em] text-black/40">
          Accès sécurisé
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-black/65">
          {description}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-black/45">
              Identifiant
            </span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-black/45">
              Mot de passe
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/25"
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </section>
    </main>
  );
}
