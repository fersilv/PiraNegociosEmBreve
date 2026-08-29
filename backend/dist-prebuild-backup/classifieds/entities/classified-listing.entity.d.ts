export type ClassifiedListingStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'SOLD' | 'ARCHIVED' | 'PENDING_REVIEW';
export type ClassifiedPriceType = 'FIXED' | 'NEGOTIABLE' | 'STARTING_AT' | 'CONTACT';
export type ClassifiedCondition = 'NEW' | 'USED' | 'REFURBISHED' | 'NOT_APPLICABLE';
export type ClassifiedListingType = 'PRODUCT' | 'SERVICE';
export type ClassifiedPublicationChannel = 'CLASSIFIEDS' | 'COMPANY_PAGE';
export type ClassifiedFulfillmentMode = 'ARRANGE' | 'PICKUP' | 'DELIVERY';
export type ClassifiedCatalogPricingStrategy = 'BASE' | 'SUM' | 'HIGHEST_SELECTION' | 'LOWEST_SELECTION' | 'AVERAGE_SELECTION';
export type ClassifiedCatalogOption = {
    id: string;
    label: string;
    priceDelta?: number;
    price?: number;
    active?: boolean;
    sku?: string;
    imageUrl?: string;
};
export type ClassifiedCatalogOptionGroup = {
    id: string;
    name: string;
    kind: 'VARIANT' | 'MODIFIER';
    selectionType: 'SINGLE' | 'MULTIPLE';
    minSelections?: number;
    maxSelections?: number;
    pricingStrategy?: ClassifiedCatalogPricingStrategy;
    options: ClassifiedCatalogOption[];
};
export type ClassifiedCatalogConfig = {
    optionGroups?: ClassifiedCatalogOptionGroup[];
    pricingStrategy?: ClassifiedCatalogPricingStrategy;
};
export type ClassifiedCommerceConfig = {
    promotion?: {
        price: number;
        startsAt?: string | null;
        endsAt?: string | null;
        endAction?: 'REVERT' | 'PAUSE';
    } | null;
    paymentPricing?: {
        pix?: {
            enabled?: boolean;
            discountType?: 'PERCENT' | 'FIXED';
            discountValue?: number;
        } | null;
        card?: {
            enabled?: boolean;
            price?: number | null;
            maxInstallments?: number;
            interestFreeInstallments?: number;
        } | null;
    } | null;
    onlineCheckout?: {
        enabled?: boolean;
        fulfillmentModes?: ClassifiedFulfillmentMode[];
        stockQuantity?: number | null;
        lowStockThreshold?: number | null;
        orderWhatsappE164?: string | null;
    } | null;
};
export declare class ClassifiedListing {
    id: string;
    slug: string;
    sellerUserId: string;
    companyId: string | null;
    categorySlug: string;
    listingType: ClassifiedListingType;
    title: string;
    description: string;
    price: string | null;
    priceType: ClassifiedPriceType;
    condition: ClassifiedCondition;
    city: string;
    state: string;
    neighborhood: string | null;
    zipCode: string | null;
    latitude: string | null;
    longitude: string | null;
    deliveryModes: ClassifiedFulfillmentMode[];
    status: ClassifiedListingStatus;
    isFeatured: boolean;
    sellerVerifiedSnapshot: boolean;
    viewsCount: number;
    favoritesCount: number;
    attributes: Record<string, string | number | boolean | null> | null;
    publicationChannels: ClassifiedPublicationChannel[];
    catalogConfig: ClassifiedCatalogConfig | null;
    commerceConfig: ClassifiedCommerceConfig | null;
    contactPhone: string | null;
    contactWhatsapp: string | null;
    moderationReason: string | null;
    duplicateOfListingId: string | null;
    moderationReviewedAt: Date | null;
    publishedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
