import { classifiedsCommerceFeatureFlags } from './classifieds-commerce-feature-flags';

describe('classifiedsCommerceFeatureFlags', () => {
  it('keeps every new commerce capability disabled by default', () => {
    expect(classifiedsCommerceFeatureFlags({} as NodeJS.ProcessEnv)).toEqual({
      cart: false,
      localDeliveryPartners: false,
      deliveryBalance: false,
      consultativeQuotes: false,
    });
  });

  it('enables capabilities only with explicit truthy environment values', () => {
    expect(classifiedsCommerceFeatureFlags({
      FEATURE_CLASSIFIEDS_CART: 'true',
      FEATURE_CLASSIFIEDS_LOCAL_DELIVERY_PARTNERS: '1',
      FEATURE_CLASSIFIEDS_DELIVERY_BALANCE: 'on',
      FEATURE_CLASSIFIEDS_CONSULTATIVE_QUOTES: 'yes',
    } as NodeJS.ProcessEnv)).toEqual({
      cart: true,
      localDeliveryPartners: true,
      deliveryBalance: true,
      consultativeQuotes: true,
    });
  });
});
