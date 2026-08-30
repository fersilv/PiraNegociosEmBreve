export type ClassifiedsCommerceFeatureFlags = {
  cart: boolean;
  localDeliveryPartners: boolean;
  deliveryBalance: boolean;
  consultativeQuotes: boolean;
};

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

function enabled(value: string | undefined): boolean {
  return ENABLED_VALUES.has(String(value || '').trim().toLowerCase());
}

/**
 * Phase 0 commerce capabilities are opt-in. New flows must remain disabled
 * until their implementation phase is complete and explicitly enabled.
 */
export function classifiedsCommerceFeatureFlags(
  env: NodeJS.ProcessEnv = process.env,
): ClassifiedsCommerceFeatureFlags {
  return {
    cart: enabled(env.FEATURE_CLASSIFIEDS_CART),
    localDeliveryPartners: enabled(env.FEATURE_CLASSIFIEDS_LOCAL_DELIVERY_PARTNERS),
    deliveryBalance: enabled(env.FEATURE_CLASSIFIEDS_DELIVERY_BALANCE),
    consultativeQuotes: enabled(env.FEATURE_CLASSIFIEDS_CONSULTATIVE_QUOTES),
  };
}
