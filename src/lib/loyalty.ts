import type { LoyaltyTier } from "@/lib/types";

const tierThresholds: Record<LoyaltyTier, number> = {
  bronze: 0,
  silver: 500,
  gold: 1500,
  platinum: 3000,
};

const tierOrder: LoyaltyTier[] = ["bronze", "silver", "gold", "platinum"];

export function getLoyaltyTier(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= tierThresholds.platinum) return "platinum";
  if (lifetimePoints >= tierThresholds.gold) return "gold";
  if (lifetimePoints >= tierThresholds.silver) return "silver";
  return "bronze";
}

export function getNextLoyaltyTier(tier: LoyaltyTier): LoyaltyTier | null {
  const currentIndex = tierOrder.indexOf(tier);
  return currentIndex >= 0 && currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;
}

export function getLoyaltyTierLabel(tier: LoyaltyTier) {
  return {
    bronze: "Bronze",
    silver: "Silver",
    gold: "Gold",
    platinum: "Platinum",
  }[tier];
}

export function getLoyaltySummary(lifetimePoints: number) {
  const tier = getLoyaltyTier(lifetimePoints);
  const nextTier = getNextLoyaltyTier(tier);
  const currentThreshold = tierThresholds[tier];
  const nextThreshold = nextTier ? tierThresholds[nextTier] : tierThresholds.platinum;
  const span = Math.max(1, nextThreshold - currentThreshold);
  const progress = Math.min(1, Math.max(0, (lifetimePoints - currentThreshold) / span));

  return {
    tier,
    tierLabel: getLoyaltyTierLabel(tier),
    nextTier,
    progress,
    nextThreshold,
    currentThreshold,
    pointsToNext: nextTier ? Math.max(0, nextThreshold - lifetimePoints) : 0,
  };
}

export function formatLoyaltyPoints(points: number) {
  return `${Math.max(0, Math.floor(points))} pts`;
}
