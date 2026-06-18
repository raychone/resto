"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type Props = {
  title: string;
  description: string;
  defaultUsername: string;
  defaultPassword: string;
  endpoint: string;
  theme?: "dark" | "food";
  oauthAction?: {
    label: string;
    href: string;
    helperText?: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  backAction?: {
    label: string;
    href: string;
  };
  notice?: string;
};

export function DashboardLogin({
  title,
  description,
  defaultUsername,
  defaultPassword,
  endpoint,
  theme = "dark",
  oauthAction,
  secondaryAction,
  backAction,
  notice,
}: Props) {
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState(defaultPassword);
  const [showPassword, setShowPassword] = useState(false);
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
    <main className={theme === "food" ? "food-theme flex min-h-screen w-full items-center justify-center px-4" : "internal-dark flex min-h-screen w-full items-center justify-center px-4"}>
      <section
        className={
          theme === "food"
            ? "w-full max-w-md rounded-[2rem] border border-[#eadfce] bg-[#fffdf8]/96 p-6 text-[#24170f] shadow-[0_24px_90px_rgba(196,30,30,0.12)] backdrop-blur"
            : "w-full max-w-md rounded-[2rem] border border-white/10 bg-[#171717]/95 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur"
        }
      >
        <div className="flex items-center justify-between gap-3">
          <p className={theme === "food" ? "text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.35em] text-white/40"}>
            Accès sécurisé
          </p>
          {backAction ? (
            <Link
              href={backAction.href}
              className={
                theme === "food"
                  ? "rounded-full border border-[#eadfce] bg-white px-3 py-2 text-xs font-medium text-[#24170f] transition hover:bg-[#faf7f2]"
                  : "rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
              }
            >
              {backAction.label}
            </Link>
          ) : null}
        </div>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className={theme === "food" ? "mt-2 text-sm leading-6 text-[#6f5b4a]" : "mt-2 text-sm leading-6 text-white/65"}>
          {description}
        </p>

        {notice ? (
          <div className={theme === "food" ? "mt-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" : "mt-4 rounded-[1.25rem] border border-amber-200/30 bg-amber-500/10 p-3 text-sm text-amber-100"}>
            {notice}
          </div>
        ) : null}

        {oauthAction ? (
          <div className={theme === "food" ? "mt-5 rounded-[1.5rem] border border-[#eadfce] bg-[#faf7f2] p-4" : "mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4"}>
            <p className={theme === "food" ? "text-[11px] uppercase tracking-[0.32em] text-[#a38d7c]" : "text-[11px] uppercase tracking-[0.32em] text-white/35"}>Connexion rapide</p>
            <a
              href={oauthAction.href}
              className={
                theme === "food"
                  ? "mt-3 flex items-center justify-center gap-3 rounded-full border border-[#c41e1e] bg-[#c41e1e] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#aa1818]"
                  : "mt-3 flex items-center justify-center gap-3 rounded-full border border-white/10 bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-white/95"
              }
            >
              <span className="text-base">◎</span>
              <span>{oauthAction.label}</span>
            </a>
            {oauthAction.helperText ? (
              <p className={theme === "food" ? "mt-2 text-xs leading-5 text-[#7f6c5a]" : "mt-2 text-xs leading-5 text-white/50"}>{oauthAction.helperText}</p>
            ) : null}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="grid gap-2">
            <span className={theme === "food" ? "text-xs font-semibold uppercase tracking-[0.28em] text-[#a38d7c]" : "text-xs font-semibold uppercase tracking-[0.28em] text-white/45"}>
              Identifiant ou e-mail
            </span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={theme === "food" ? "rounded-2xl border border-[#eadfce] bg-white px-4 py-3 text-[#24170f] outline-none transition focus:border-[#c41e1e]" : "rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/25"}
            />
          </label>
          <label className="grid gap-2">
            <span className={theme === "food" ? "text-xs font-semibold uppercase tracking-[0.28em] text-[#a38d7c]" : "text-xs font-semibold uppercase tracking-[0.28em] text-white/45"}>
              Mot de passe
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={theme === "food" ? "w-full rounded-2xl border border-[#eadfce] bg-white px-4 py-3 pr-12 text-[#24170f] outline-none transition focus:border-[#c41e1e]" : "w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 pr-12 text-white outline-none transition focus:border-white/25"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className={theme === "food" ? "absolute inset-y-0 right-0 flex items-center justify-center px-4 text-[#7f6c5a] transition hover:text-[#24170f]" : "absolute inset-y-0 right-0 flex items-center justify-center px-4 text-white/55 transition hover:text-white"}
                aria-label={showPassword ? "Masque le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </label>

          {error ? <p className={theme === "food" ? "text-sm text-rose-700" : "text-sm text-red-600"}>{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className={theme === "food" ? "w-full rounded-full bg-[#c41e1e] px-4 py-3 text-sm font-medium text-white disabled:opacity-60" : "w-full rounded-full bg-white px-4 py-3 text-sm font-medium text-black disabled:opacity-60"}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          {secondaryAction ? (
            <a
              href={secondaryAction.href}
              className={theme === "food" ? "block text-center text-sm font-medium text-[#6f5b4a] transition hover:text-[#24170f]" : "block text-center text-sm font-medium text-white/75 transition hover:text-white"}
            >
              {secondaryAction.label}
            </a>
          ) : null}
        </form>
      </section>
    </main>
  );
}
