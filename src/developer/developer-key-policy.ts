import { Logger } from "@nestjs/common";
import { PlanCode } from "../billing/entities/plan.entity";
import { ApiKeyMode } from "../partner/entities/api-key.entity";

/** Limites appliquées à une clé générée depuis l'espace développeur. */
export interface KeyLimits {
  quotaPerHour: number;
  quotaPerMonth: number;
  /** Durée de validité maximale, en jours */
  maxDays: number;
  /** Durée proposée par défaut, en jours */
  defaultDays: number;
}

/**
 * Grille par défaut :
 *   - clés de test (sk_test_/pk_test_) : mêmes limites quel que soit le tarif ;
 *   - clés de production (sk_live_/pk_live_) : selon le tarif de l'organisation.
 */
export interface KeyPolicy {
  test: KeyLimits;
  live: Record<PlanCode, KeyLimits>;
  /** Clés actives (non révoquées, non expirées) par organisation */
  maxActiveKeys: number;
}

export const DEFAULT_KEY_POLICY: KeyPolicy = {
  test: {
    quotaPerHour: 100,
    quotaPerMonth: 2_000,
    maxDays: 30,
    defaultDays: 30,
  },
  live: {
    free: {
      quotaPerHour: 500,
      quotaPerMonth: 10_000,
      maxDays: 90,
      defaultDays: 90,
    },
    pro: {
      quotaPerHour: 5_000,
      quotaPerMonth: 200_000,
      maxDays: 365,
      defaultDays: 180,
    },
    enterprise: {
      quotaPerHour: 50_000,
      quotaPerMonth: 5_000_000,
      maxDays: 365,
      defaultDays: 365,
    },
  },
  maxActiveKeys: 10,
};

/**
 * Politique effective : la grille par défaut, éventuellement surchargée par
 * la variable DEVELOPER_KEY_POLICY (JSON partiel, ex.
 * {"live":{"pro":{"quotaPerHour":8000}}}). Une valeur invalide est ignorée.
 */
export function loadKeyPolicy(raw: string | undefined): KeyPolicy {
  if (!raw) return DEFAULT_KEY_POLICY;
  try {
    const o = JSON.parse(raw) as Partial<{
      test: Partial<KeyLimits>;
      live: Partial<Record<PlanCode, Partial<KeyLimits>>>;
      maxActiveKeys: number;
    }>;
    const merged: KeyPolicy = {
      test: { ...DEFAULT_KEY_POLICY.test, ...o.test },
      live: {
        free: { ...DEFAULT_KEY_POLICY.live.free, ...o.live?.free },
        pro: { ...DEFAULT_KEY_POLICY.live.pro, ...o.live?.pro },
        enterprise: {
          ...DEFAULT_KEY_POLICY.live.enterprise,
          ...o.live?.enterprise,
        },
      },
      maxActiveKeys: o.maxActiveKeys ?? DEFAULT_KEY_POLICY.maxActiveKeys,
    };
    const all = [merged.test, ...Object.values(merged.live)];
    const valid =
      Number.isInteger(merged.maxActiveKeys) &&
      merged.maxActiveKeys > 0 &&
      all.every(
        (l) =>
          [l.quotaPerHour, l.quotaPerMonth, l.maxDays, l.defaultDays].every(
            (n) => Number.isInteger(n) && n > 0,
          ) && l.defaultDays <= l.maxDays,
      );
    if (!valid) throw new Error("valeurs non entières ou incohérentes");
    return merged;
  } catch (e) {
    new Logger("DeveloperKeyPolicy").error(
      `DEVELOPER_KEY_POLICY ignorée (${(e as Error).message}) — grille par défaut appliquée`,
    );
    return DEFAULT_KEY_POLICY;
  }
}

export function limitsFor(
  policy: KeyPolicy,
  mode: ApiKeyMode,
  plan: PlanCode,
): KeyLimits {
  return mode === "test"
    ? policy.test
    : (policy.live[plan] ?? policy.live.free);
}
