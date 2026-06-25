"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale, MenuCategory, MenuItem } from "@/lib/types";
import { getMenuItemEffectivePrice } from "@/lib/types";
import { addClientCartItem } from "@/lib/client-cart";

type Props = {
  categories: MenuCategory[];
  locale: Locale;
  accent: string;
  restaurantSlug: string;
  orderFlowEnabled: boolean;
  theme?: "dark" | "food";
  actionLabel?: string;
  showItemModal?: boolean;
  compact?: boolean;
  testIdPrefix?: string;
  onItemAction?: (item: MenuItem, categoryName: string) => void | Promise<void>;
};

type ItemModalState = {
  categoryName: string;
  item: MenuItem;
} | null;

const labels: Record<
  Locale,
  {
    signature: string;
    allergens: string;
    ingredients: string;
    recipe: string;
    close: string;
    modalTitle: string;
    details: string;
    noAllergen: string;
  }
> = {
  fr: {
    signature: "Signature",
    allergens: "Allergènes",
    ingredients: "Ingrédients",
    recipe: "Préparation",
    close: "Fermer",
    modalTitle: "Détail du plat",
    details: "Détails",
    noAllergen: "Aucun allergène déclaré",
  },
  en: {
    signature: "Signature",
    allergens: "Allergens",
    ingredients: "Ingredients",
    recipe: "Recipe",
    close: "Close",
    modalTitle: "Dish details",
    details: "Details",
    noAllergen: "No allergens declared",
  },
  it: {
    signature: "Signature",
    allergens: "Allergeni",
    ingredients: "Ingredienti",
    recipe: "Preparazione",
    close: "Chiudi",
    modalTitle: "Dettagli del piatto",
    details: "Dettagli",
    noAllergen: "Nessun allergene dichiarato",
  },
  es: {
    signature: "Signature",
    allergens: "Alérgenos",
    ingredients: "Ingredientes",
    recipe: "Preparación",
    close: "Cerrar",
    modalTitle: "Detalles del plato",
    details: "Detalles",
    noAllergen: "No hay alérgenos declarados",
  },
};

function money(amount: number) {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2);
  return `${formatted}€`;
}

export function PublicMenuCategories({
  categories,
  locale,
  accent,
  restaurantSlug,
  orderFlowEnabled,
  theme = "dark",
  actionLabel,
  showItemModal = true,
  compact = false,
  testIdPrefix,
  onItemAction,
}: Props) {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ItemModalState>(null);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const modalCloseTimer = useRef<number | null>(null);
  const cartNoticeTimer = useRef<number | null>(null);
  const text = labels[locale];
  const isFoodTheme = theme === "food";

  function openModal(item: MenuItem, categoryName: string) {
    if (modalCloseTimer.current) {
      window.clearTimeout(modalCloseTimer.current);
      modalCloseTimer.current = null;
    }
    setIsModalClosing(false);
    setModalState({ categoryName, item });
  }

  async function triggerItemAction(item: MenuItem, categoryName: string) {
    if (!orderFlowEnabled) return;

    if (onItemAction) {
      await onItemAction(item, categoryName);
    } else {
      addClientCartItem(restaurantSlug, {
        menuItemId: item.id,
        name: item.name,
        price: getMenuItemEffectivePrice(item),
        quantity: 1,
        categoryName,
      });
    }

    const label = actionLabel?.toLowerCase().includes("bon") ? "au bon" : "au panier";
    const itemLabel = locale === "fr" ? `« ${item.name} »` : item.name;
    setCartNotice(locale === "fr" ? `${itemLabel} ajouté ${label}.` : `${item.name} added.`);
    if (cartNoticeTimer.current) {
      window.clearTimeout(cartNoticeTimer.current);
    }
    cartNoticeTimer.current = window.setTimeout(() => {
      setCartNotice(null);
      cartNoticeTimer.current = null;
    }, 2400);
  }

  async function handleAction() {
    if (!modalState || !orderFlowEnabled) return;
    await triggerItemAction(modalState.item, modalState.categoryName);
    closeModal();
  }

  const closeModal = useCallback(() => {
    if (!modalState || isModalClosing) {
      return;
    }

    setIsModalClosing(true);
    modalCloseTimer.current = window.setTimeout(() => {
      setModalState(null);
      setIsModalClosing(false);
      modalCloseTimer.current = null;
    }, 180);
  }, [isModalClosing, modalState]);

  useEffect(() => {
    if (!modalState) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [closeModal, modalState]);

  useEffect(() => {
    return () => {
      if (modalCloseTimer.current) {
        window.clearTimeout(modalCloseTimer.current);
      }
      if (cartNoticeTimer.current) {
        window.clearTimeout(cartNoticeTimer.current);
      }
    };
  }, []);

  const activeItemMeta = useMemo(() => {
    if (!modalState) return null;
    return {
      allergens:
        modalState.item.allergens.length > 0
          ? modalState.item.allergens.join(", ")
          : text.noAllergen,
    };
  }, [modalState, text.noAllergen]);

  return (
    <>
      <div className="grid gap-3 sm:gap-4">
        {categories.map((category) => {
          const isOpen = category.id === openCategoryId;
          return (
            <section
              key={category.id}
              className={`overflow-hidden rounded-[2rem] border transition duration-300 ${
                isFoodTheme
                  ? "border-[#eadfce] bg-white shadow-[0_18px_50px_rgba(124,77,44,0.06)] hover:border-[#d8cabc]"
                  : "border-white/8 bg-[#141414] shadow-[0_24px_80px_rgba(0,0,0,0.28)] hover:border-white/15"
              } ${
                compact ? "rounded-[1.5rem]" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenCategoryId(isOpen ? null : category.id)}
                data-testid={testIdPrefix ? `${testIdPrefix}-category-${category.id}` : undefined}
                className={`flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition duration-300 sm:px-5 sm:py-5 ${
                  isFoodTheme
                    ? "text-[#24170f] hover:bg-[#faf7f2]"
                    : "text-[#f5f1ea] hover:bg-white/[0.02]"
                } ${
                  compact ? "px-4 py-3 sm:px-4 sm:py-3" : ""
                }`}
              >
                <div className="min-w-0">
                  <h2
                    className={`font-semibold leading-[0.95] ${
                      compact
                        ? "text-[1rem] sm:text-[1.2rem] lg:text-[1.35rem]"
                        : "text-[1.32rem] sm:text-[1.95rem] lg:text-[2.35rem]"
                    }`}
                  >
                    {category.name}
                  </h2>
                </div>
                <span
                  className={`text-xl leading-none transition-transform duration-300 ${
                    isFoodTheme ? "text-[#7f6c5a]" : "text-white"
                  } ${
                    isOpen ? "rotate-180" : "rotate-0"
                  }`}
                >
                  ▾
                </span>
              </button>

              <div
                className={`grid transition-all duration-500 ease-out ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className={`px-4 pb-2 pt-1 sm:px-5 ${isFoodTheme ? "border-t border-[#eadfce]" : "border-t border-white/8"} ${compact ? "px-3 pb-1 pt-0.5 sm:px-4" : ""}`}>
                    <div className="mt-2">
                      {category.items.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          data-testid={testIdPrefix ? `${testIdPrefix}-item-${item.id}` : undefined}
                        onClick={() => {
                          if (showItemModal) {
                            openModal(item, category.name);
                            return;
                          }
                          void triggerItemAction(item, category.name);
                        }}
                          className={`group flex w-full items-center justify-between gap-4 py-3 text-left transition duration-300 hover:translate-x-0.5 focus:outline-none ${
                            isFoodTheme
                              ? "text-[#24170f] hover:text-[#24170f] focus:ring-2 focus:ring-[#d8ecd3]"
                              : "text-[#f5f1ea] hover:text-white focus:ring-2 focus:ring-white/20"
                          } ${
                            compact ? "py-2.5" : "py-3"
                          } ${
                            index !== category.items.length - 1
                              ? isFoodTheme
                                ? "border-b border-dashed border-[#eadfce]"
                                : "border-b border-dashed border-white/12"
                              : ""
                          }`}
                        >
                          <div className="min-w-0">
                            <h3
                              className={`font-medium leading-[1.1] ${
                                compact ? "text-[0.75rem] sm:text-[0.82rem]" : "text-[0.86rem] sm:text-[0.95rem]"
                              }`}
                            >
                              {item.name}
                            </h3>
                          </div>
                          <div className="shrink-0 text-right">
                            <span
                              className={`inline-block font-medium leading-none ${
                                isFoodTheme ? "text-[#6f5b4a]" : "text-white/90"
                              } ${
                                compact ? "text-[0.8rem] sm:text-[0.86rem]" : "text-[0.85rem] sm:text-[0.95rem]"
                              }`}
                            >
                              {money(getMenuItemEffectivePrice(item))}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {modalState ? (
        <div
          className={`fixed inset-0 z-[80] p-2 sm:p-4 ${isFoodTheme ? "bg-[#24170f]/30" : "bg-black/75"} ${isModalClosing ? "opacity-0" : "opacity-100"} transition-opacity duration-200`}
          role="dialog"
          aria-modal="true"
          aria-label={text.modalTitle}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="mx-auto flex h-full w-full max-w-3xl items-start justify-center overflow-hidden">
            <section
              className={`flex h-[calc(100vh-1rem)] w-full flex-col overflow-hidden rounded-[2rem] border transition-all duration-300 sm:h-[calc(100vh-2rem)] ${
                isFoodTheme
                  ? "border-[#eadfce] bg-[#fffdf8] text-[#24170f] shadow-[0_30px_90px_rgba(124,77,44,0.18)]"
                  : "border-white/10 bg-[#111111] text-[#f5f1ea] shadow-[0_40px_120px_rgba(0,0,0,0.45)]"
              } ${
                isModalClosing ? "scale-[0.985] opacity-0" : "scale-100 opacity-100"
              }`}
            >
              <div className={`sticky top-0 z-10 flex items-start justify-between gap-4 border-b px-4 py-4 backdrop-blur sm:px-6 ${isFoodTheme ? "border-[#eadfce] bg-[#fffdf8]/95" : "border-white/8 bg-[#111111]/95"}`}>
                <div className="space-y-1">
                  <p className={`text-[11px] uppercase tracking-[0.35em] ${isFoodTheme ? "text-[#a38d7c]" : "text-white/35"}`}>
                    {modalState.categoryName}
                  </p>
                  <h3 className="text-2xl font-semibold sm:text-3xl">
                    {modalState.item.name}
                  </h3>
                  <p className={`text-sm leading-6 ${isFoodTheme ? "text-[#6f5b4a]" : "text-white/60"}`}>{text.details}</p>
                </div>
                  <button
                  type="button"
                  onClick={closeModal}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-2xl leading-none transition ${isFoodTheme ? "border-[#eadfce] bg-white text-[#24170f] hover:bg-[#faf7f2]" : "border-white/10 bg-white/5 text-[#f5f1ea] hover:bg-white/10"}`}
                  aria-label={text.close}
                >
                  ×
                </button>
              </div>

              <div className="grid flex-1 gap-5 overflow-y-auto p-4 sm:grid-cols-[0.95fr_1.05fr] sm:p-6">
                <div className={`relative overflow-hidden rounded-[1.75rem] border ${isFoodTheme ? "border-[#eadfce] bg-[#faf7f2]" : "border-white/8 bg-white/5"}`}>
                  <img
                    src={modalState.item.imageUrl}
                    alt={modalState.item.name}
                    className="h-[34vh] w-full object-cover sm:h-full sm:min-h-[320px]"
                  />
                  {modalState.item.isSignature ? (
                    <span
                      className="absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
                      style={{
                        backgroundColor: `${accent}d9`,
                      }}
                    >
                      {text.signature}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <p className={`text-base leading-7 ${isFoodTheme ? "text-[#6f5b4a]" : "text-white/80"}`}>{modalState.item.description}</p>

                  <div className={`rounded-[1.4rem] border p-4 ${isFoodTheme ? "border-[#eadfce] bg-white" : "border-white/8 bg-white/5"}`}>
                    <p className={`text-[11px] uppercase tracking-[0.3em] ${isFoodTheme ? "text-[#a38d7c]" : "text-white/35"}`}>
                      {text.recipe}
                    </p>
                    <p className={`mt-2 text-sm leading-6 ${isFoodTheme ? "text-[#6f5b4a]" : "text-white/75"}`}>{modalState.item.recipe}</p>
                  </div>

                  <div className={`rounded-[1.4rem] border p-4 ${isFoodTheme ? "border-[#eadfce] bg-white" : "border-white/8 bg-white/5"}`}>
                    <p className={`text-[11px] uppercase tracking-[0.3em] ${isFoodTheme ? "text-[#a38d7c]" : "text-white/35"}`}>
                      {text.ingredients}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {modalState.item.ingredients.map((ingredient) => (
                        <span
                          key={ingredient}
                          className={isFoodTheme ? "rounded-full border border-[#eadfce] bg-[#faf7f2] px-3 py-1.5 text-sm text-[#24170f]" : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80"}
                        >
                          {ingredient}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className={`rounded-[1.4rem] border p-4 ${isFoodTheme ? "border-[#eadfce] bg-white" : "border-white/8 bg-white/5"}`}>
                    <p className={`text-[11px] uppercase tracking-[0.3em] ${isFoodTheme ? "text-[#a38d7c]" : "text-white/35"}`}>
                      {text.allergens}
                    </p>
                    <p className={`mt-2 text-sm leading-6 ${isFoodTheme ? "text-[#6f5b4a]" : "text-white/75"}`}>
                      {activeItemMeta?.allergens}
                    </p>
                  </div>

                  <div className={`rounded-[1.4rem] border p-4 ${isFoodTheme ? "border-[#eadfce] bg-white" : "border-white/8 bg-white/5"}`}>
                    <p className={`text-[11px] uppercase tracking-[0.3em] ${isFoodTheme ? "text-[#a38d7c]" : "text-white/35"}`}>
                      Prix
                    </p>
                    <p className="mt-2 text-3xl font-semibold" style={{ color: accent }}>
                      {money(getMenuItemEffectivePrice(modalState.item))}
                    </p>
                  </div>

                  {orderFlowEnabled ? (
                    <button
                      type="button"
                      onClick={() => void handleAction()}
                      className={isFoodTheme ? "w-full rounded-full border border-[#9fbe9c] bg-gradient-to-b from-[#eef8eb] to-[#d8ecd3] px-4 py-3 text-sm font-semibold text-[#1f2b1f] transition hover:brightness-95" : "w-full rounded-full border border-white/10 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"}
                    >
                      {actionLabel ?? "Ajouter au panier"}
                    </button>
                  ) : (
                    <div className={isFoodTheme ? "rounded-full border border-[#eadfce] bg-[#faf7f2] px-4 py-3 text-center text-sm text-[#6f5b4a]" : "rounded-full border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-white/60"}>
                      Commande désactivée pour ce restaurant.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}
      {cartNotice ? (
        <div
          className={`fixed bottom-4 left-1/2 z-[90] w-[calc(100vw-1rem)] max-w-md -translate-x-1/2 rounded-[1.25rem] border px-4 py-3 text-center text-sm shadow-[0_20px_50px_rgba(0,0,0,0.18)] transition ${
            isFoodTheme
              ? "border-[#9fbe9c] bg-[#eef8eb] text-[#1f2b1f]"
              : "border-white/10 bg-[#111111] text-white"
          }`}
          role="status"
          aria-live="polite"
        >
          {cartNotice}
        </div>
      ) : null}
    </>
  );
}
