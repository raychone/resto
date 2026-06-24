"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-[#f6efe6] px-4 py-8 text-[#24170f]">
        <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
          <section className="w-full rounded-[2rem] border border-[#eadfce] bg-[#fffdf8] p-6 text-center shadow-[0_18px_60px_rgba(36,23,15,0.08)] sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.36em] text-[#a38d7c]">
              Application error
            </p>
            <h1 className="mt-3 text-3xl font-semibold">L’application n’a pas pu charger.</h1>
            <p className="mt-4 text-sm leading-7 text-[#6f5b4a]">
              Une erreur est survenue pendant le rendu global. Recharge la page ou retourne à
              l’accueil.
            </p>
            {error.digest ? <p className="mt-3 text-xs text-[#a38d7c]">Digest: {error.digest}</p> : null}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-[#c41e1e] bg-[#c41e1e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#aa1818]"
              >
                Réessayer
              </button>
              <Link
                href="/"
                className="rounded-full border border-[#e7ddd0] bg-white px-5 py-3 text-sm font-semibold text-[#24170f] transition hover:bg-[#faf7f2]"
              >
                Accueil
              </Link>
            </div>
          </section>
        </div>
      </body>
    </html>
  );
}
