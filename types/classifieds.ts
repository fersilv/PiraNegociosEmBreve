export type ClassifiedListingStatus = 'DRAFT'|'PUBLISHED'|'PAUSED'|'SOLD'|'ARCHIVED'|'PENDING_REVIEW';
export type ClassifiedPriceType = 'FIXED'|'NEGOTIABLE'|'STARTING_AT'|'CONTACT';
export type ClassifiedCondition = 'NEW'|'USED'|'REFURBISHED'|'NOT_APPLICABLE';
export type ClassifiedListingType = 'PRODUCT'|'SERVICE';
export type ClassifiedPublicationChannel = 'CLASSIFIEDS'|'COMPANY_PAGE';
export type ClassifiedFulfillmentMode = 'ARRANGE'|'PICKUP'|'DELIVERY';
export type ClassifiedIdentityType = 'PERSONAL'|'COMPANY';
export type ClassifiedConversationSide = 'BUYER'|'SELLER';
export type ClassifiedCatalogPricingStrategy = 'BASE'|'SUM'|'HIGHEST_SELECTION'|'LOWEST_SELECTION'|'AVERAGE_SELECTION';
export type ClassifiedOfferStatus = 'PENDING'|'ACCEPTED'|'REJECTED'|'EXPIRED'|'WITHDRAWN'|'REVOKED'|'CONSUMED';

export interface ClassifiedCategory { slug:string; name:string; icon?:string|null; parentSlug?:string|null; sortOrder?:number; isActive?:boolean; attributeSchema?:Array<{key:string;label:string;type?:'text'|'number'|'select';options?:string[]}>|null }
export interface ClassifiedListingImage { id?:string; url:string; sortOrder?:number; isPrimary?:boolean }
export interface ClassifiedSeller { id:string;type:'COMPANY'|'PERSON';name:string;photoURL?:string|null;verified?:boolean;memberSince?:string|null;city?:string|null;state?:string|null;companySlug?:string|null }
export interface ClassifiedCatalogOption { id:string;label:string;priceDelta?:number;price?:number;active?:boolean;sku?:string;imageUrl?:string }
export interface ClassifiedCatalogOptionGroup { id:string;name:string;kind:'VARIANT'|'MODIFIER';selectionType:'SINGLE'|'MULTIPLE';minSelections?:number;maxSelections?:number;pricingStrategy?:ClassifiedCatalogPricingStrategy;options:ClassifiedCatalogOption[] }
export interface ClassifiedCatalogConfig { optionGroups?:ClassifiedCatalogOptionGroup[];pricingStrategy?:ClassifiedCatalogPricingStrategy }

export interface ClassifiedCommerceConfig {
  promotion?:{price:number;startsAt?:string|null;endsAt?:string|null;endAction?:'REVERT'|'PAUSE'}|null;
  paymentPricing?:{pix?:{enabled?:boolean;discountType?:'PERCENT'|'FIXED';discountValue?:number}|null;card?:{enabled?:boolean;price?:number|null;maxInstallments?:number;interestFreeInstallments?:number}|null}|null;
  paymentOnReceipt?:{mode?:'INHERIT'|'ONLINE_ONLY'|'DISABLED';disabled?:boolean}|null;
  onlineCheckout?:{enabled?:boolean;fulfillmentModes?:ClassifiedFulfillmentMode[];stockQuantity?:number|null;lowStockThreshold?:number|null;orderWhatsappE164?:string|null}|null;
}
export interface ClassifiedEffectivePricing {basePrice:number|null;currentPrice:number|null;promotionActive:boolean;promotionEndsAt?:string|null;pixPrice:number|null;cardPrice:number|null;maxInstallments:number;interestFreeInstallments:number}

export interface ClassifiedListing {
  id:string;slug:string;sellerUserId?:string;companyId?:string|null;categorySlug:string;listingType?:ClassifiedListingType;title:string;description:string;price?:string|number|null;priceType:ClassifiedPriceType;condition:ClassifiedCondition;city:string;state:string;neighborhood?:string|null;
  /** Exact zip/coordinates are intentionally omitted from public hydration. Legacy optional keys remain only for owned drafts. */
  zipCode?:string|null;latitude?:string|null;longitude?:string|null;
  deliveryModes?:ClassifiedFulfillmentMode[];distanceKm?:number|null;
  status:ClassifiedListingStatus;isFeatured?:boolean;sellerVerifiedSnapshot?:boolean;viewsCount?:number;favoritesCount?:number;attributes?:Record<string,string|number|boolean|null>|null;publicationChannels?:ClassifiedPublicationChannel[];catalogConfig?:ClassifiedCatalogConfig|null;commerceConfig?:ClassifiedCommerceConfig|null;contactPhone?:string|null;contactWhatsapp?:string|null;moderationReason?:string|null;duplicateOfListingId?:string|null;moderationReviewedAt?:string|null;publishedAt?:string|null;expiresAt?:string|null;createdAt?:string;updatedAt?:string;images?:ClassifiedListingImage[];isFavorite?:boolean;seller?:ClassifiedSeller;related?:ClassifiedListing[];
}
export interface ClassifiedSearchResponse {items:ClassifiedListing[];total:number;page:number;limit:number;pages:number;proximityApplied?:boolean}
export interface ClassifiedWorkspaceContextData {termsVersion:string;needsIdentitySelection:boolean;activeIdentity:ClassifiedIdentityType|null;personal:{available:boolean;termsAccepted:boolean;termsAcceptedAt?:string|null;name:string;photoURL?:string|null};company:null|{id:string;name:string;logoURL?:string|null;available:boolean;verified:boolean;termsAccepted:boolean;requiresOnboarding:boolean;canSellProducts:boolean;canOfferServices:boolean;businessSegments:string[];defaultPublicationChannels:ClassifiedPublicationChannel[];pageSectionLabel?:string|null}}
export interface ClassifiedConversationParty {id:string;type:'COMPANY'|'PERSON';name:string;photoURL?:string|null;verified?:boolean}
export interface ClassifiedChatLabel {id:string;companyId:string;name:string;colorKey:'STONE'|'BLUE'|'AMBER'|'VIOLET'|'GREEN'|'ROSE'|'TEAL'|string;isSystem:boolean}
export interface ClassifiedConversation {id:string;listingId:string;buyerUserId:string;buyerCompanyId?:string|null;sellerUserId:string;sellerCompanyId?:string|null;role:ClassifiedConversationSide;unreadCount:number;lastMessageAt?:string|null;customName?:string|null;labels?:ClassifiedChatLabel[];listing:null|{id:string;slug:string;title:string;price?:string|number|null;priceType:ClassifiedPriceType;status:ClassifiedListingStatus;image?:string|null};buyer:ClassifiedConversationParty;seller:ClassifiedConversationParty;lastMessage?:null|{id:string;senderId:string;senderRole:ClassifiedConversationSide;body:string;createdAt:string}}
export interface ClassifiedConversationMessage {id:string;conversationId:string;senderId:string;senderName:string;senderRole:ClassifiedConversationSide;body:string;messageType:'TEXT'|'OFFER'|'SYSTEM';metadata?:Record<string,unknown>|null;createdAt:string}
export interface ClassifiedOffer {id:string;listingId:string;buyerUserId:string;buyerCompanyId?:string|null;sellerUserId:string;sellerCompanyId?:string|null;amount:string|number;status:ClassifiedOfferStatus;expiresAt:string;respondedAt?:string|null;revokedAt?:string|null;revokedByUserId?:string|null;consumedAt?:string|null;orderId?:string|null;createdAt:string;updatedAt:string;role:'BUYER'|'SELLER';title:string;slug:string;price?:string|number|null;priceType?:ClassifiedPriceType;listingStatus?:ClassifiedListingStatus;image?:string|null;buyerName?:string;sellerName?:string}
export interface ClassifiedLimits {photoLimit:number;plan:'FREE'|'PLUS'|'ELITE'|string;paid:boolean;auctionCreation?:boolean}
export interface ClassifiedCommerceFeeRule {source:'CUSTOM'|'FREE'|'PLUS'|'ELITE'|string;rateBps:number;percentage:number;minimumFeeCents:number;maximumFeeCents:number|null}
export interface ClassifiedCommerceStatus {business:boolean;companyId?:string;companyVerified?:boolean;onlineSalesAvailable:boolean;plan:string;feeRule:ClassifiedCommerceFeeRule|null;paymentConnections:Array<{provider:'MERCADO_PAGO'|'EFI'|string;status:string;externalUserId?:string|null;externalUserName?:string|null;externalUserEmail?:string|null;tokenExpiresAt?:string|null;connectedAt?:string|null;updatedAt?:string|null}>}
export interface ClassifiedSalesDashboard {totals:{orders:number;paid:number;revenue:number;fees:number;net:number};recentOrders:any[];products:Array<{id:string;title:string;slug:string;orders:number;units:number;revenue:number}>;calendar:Array<{day:string;orders:number;revenue:number}>}
export interface ClassifiedAnalytics {totals:{views:number;favorites:number;conversations:number;offers:number;acceptedOffers:number;contactClicks:number};listings:Array<{id:string;title:string;slug:string;listingType:ClassifiedListingType;status:ClassifiedListingStatus;views:number;favorites:number;conversations:number;offers:number;acceptedOffers:number;contactClicks:number}>;daily:Array<{day:string;eventType:string;count:number}>}
