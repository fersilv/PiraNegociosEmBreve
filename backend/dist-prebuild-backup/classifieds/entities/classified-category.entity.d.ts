export declare class ClassifiedCategory {
    slug: string;
    name: string;
    icon: string | null;
    parentSlug: string | null;
    sortOrder: number;
    isActive: boolean;
    attributeSchema: Record<string, unknown>[] | null;
    createdAt: Date;
    updatedAt: Date;
}
