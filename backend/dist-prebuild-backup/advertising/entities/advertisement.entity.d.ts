export declare class Advertisement {
    id: string;
    title: string;
    type: string;
    description: string | null;
    imageURL: string;
    link: string;
    companyId: string | null;
    contractedByUserId: string | null;
    price: string | null;
    billingPeriod: string | null;
    startsAt: Date | null;
    endsAt: Date | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}
