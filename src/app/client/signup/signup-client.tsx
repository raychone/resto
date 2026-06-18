"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ClientSignupClient() {
  const searchParams = useSearchParams();
  const restaurantSlug = searchParams.get("restaurantSlug") || "bar-1";
  const isFoodDemo = restaurantSlug === "food-1";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/client-auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, restaurantSlug }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error || "Impossible de créer le compte.");
      setLoading(false);
      return;
    }

    window.location.href = `/client?restaurantSlug=${encodeURIComponent(restaurantSlug)}&focus=cart`;
  }

  return (
    <main
      className={
        isFoodDemo
          ? "food-theme flex min-h-screen w-full items-center justify-center px-4"
          : "internal-dark flex min-h-screen w-full items-center justify-center px-4"
      }
    >
      <section
        className={
          isFoodDemo
            ? "w-full max-w-md rounded-[2rem] border border-[#eadfce] bg-[#fffdf8]/96 p-6 text-[#24170f] shadow-[0_24px_90px_rgba(196,30,30,0.12)] backdrop-blur"
            : "w-full max-w-md rounded-[2rem] border border-white/10 bg-[#171717]/95 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur"
        }
      >
        <div className="flex items-center justify-between gap-3">
          <p
            className={
              isFoodDemo
                ? "text-[11px] uppercase tracking-[0.35em] text-[#a38d7c]"
                : "text-[11px] uppercase tracking-[0.35em] text-white/40"
            }
          >
            Accès client
          </p>
          <Link
            href="/"
            className={
              isFoodDemo
                ? "rounded-full border border-[#eadfce] bg-white px-3 py-2 text-xs font-medium text-[#24170f] transition hover:bg-[#faf7f2]"
                : "rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
            }
          >
            Accueil
          </Link>
        </div>
        <h1 className="mt-2 text-3xl font-semibold">Créer un compte</h1>
        <p
          className={
            isFoodDemo
              ? "mt-2 text-sm leading-6 text-[#6f5b4a]"
              : "mt-2 text-sm leading-6 text-white/65"
          }
        >
          Compte gratuit pour suivre ton loyalty et voir ton split de note.
        </p>

        <div
          className={
            isFoodDemo
              ? "mt-5 rounded-[1.5rem] border border-[#eadfce] bg-[#faf7f2] p-4"
              : "mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4"
          }
        >
          <p
            className={
              isFoodDemo
                ? "text-[11px] uppercase tracking-[0.32em] text-[#a38d7c]"
                : "text-[11px] uppercase tracking-[0.32em] text-white/35"
            }
          >
            Connexion rapide
          </p>
          <a
            href={`/api/client-auth/google/start?restaurantSlug=${encodeURIComponent(restaurantSlug)}&returnTo=${encodeURIComponent(
              `/client?restaurantSlug=${encodeURIComponent(restaurantSlug)}&focus=cart`,
            )}`}
            className={
              isFoodDemo
                ? "mt-3 flex items-center justify-center gap-3 rounded-full border border-[#c41e1e] bg-[#c41e1e] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#aa1818]"
                : "mt-3 flex items-center justify-center gap-3 rounded-full border border-white/10 bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-white/95"
            }
          >
            <span className="text-base">G</span>
            <span>Continuer avec Google</span>
          </a>
          <p
            className={
              isFoodDemo
                ? "mt-2 text-xs leading-5 text-[#7f6c5a]"
                : "mt-2 text-xs leading-5 text-white/50"
            }
          >
            Comptes gratuits. Si le compte n’existe pas, il est créé automatiquement.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="grid gap-2">
            <span
              className={
                isFoodDemo
                  ? "text-xs font-semibold uppercase tracking-[0.28em] text-[#a38d7c]"
                  : "text-xs font-semibold uppercase tracking-[0.28em] text-white/45"
              }
            >
              Nom
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={
                isFoodDemo
                  ? "rounded-2xl border border-[#eadfce] bg-white px-4 py-3 text-[#24170f] outline-none transition focus:border-[#c41e1e]"
                  : "rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/25"
              }
            />
          </label>

          <label className="grid gap-2">
            <span
              className={
                isFoodDemo
                  ? "text-xs font-semibold uppercase tracking-[0.28em] text-[#a38d7c]"
                  : "text-xs font-semibold uppercase tracking-[0.28em] text-white/45"
              }
            >
              Gmail ou e-mail
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={
                isFoodDemo
                  ? "rounded-2xl border border-[#eadfce] bg-white px-4 py-3 text-[#24170f] outline-none transition focus:border-[#c41e1e]"
                  : "rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none transition focus:border-white/25"
              }
            />
          </label>

          <label className="grid gap-2">
            <span
              className={
                isFoodDemo
                  ? "text-xs font-semibold uppercase tracking-[0.28em] text-[#a38d7c]"
                  : "text-xs font-semibold uppercase tracking-[0.28em] text-white/45"
              }
            >
              Mot de passe
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={
                  isFoodDemo
                    ? "w-full rounded-2xl border border-[#eadfce] bg-white px-4 py-3 pr-12 text-[#24170f] outline-none transition focus:border-[#c41e1e]"
                    : "w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 pr-12 text-white outline-none transition focus:border-white/25"
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className={
                  isFoodDemo
                    ? "absolute inset-y-0 right-0 flex items-center justify-center px-4 text-[#7f6c5a] transition hover:text-[#24170f]"
                    : "absolute inset-y-0 right-0 flex items-center justify-center px-4 text-white/55 transition hover:text-white"
                }
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </label>

          {error ? <p className={isFoodDemo ? "text-sm text-rose-700" : "text-sm text-red-500"}>{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className={
              isFoodDemo
                ? "w-full rounded-full bg-[#c41e1e] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                : "w-full rounded-full bg-white px-4 py-3 text-sm font-medium text-black disabled:opacity-60"
            }
          >
            {loading ? "Création..." : "Créer le compte"}
          </button>

          <a
            href="/client"
            className={
              isFoodDemo
                ? "block text-center text-sm font-medium text-[#6f5b4a] transition hover:text-[#24170f]"
                : "block text-center text-sm font-medium text-white/75 transition hover:text-white"
            }
          >
            J’ai déjà un compte
          </a>
        </form>
      </section>
    </main>
  );
}
