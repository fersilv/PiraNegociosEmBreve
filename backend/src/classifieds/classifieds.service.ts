import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Company, CompanyStatus } from '../companies/entities/company.entity';
import { User } from '../users/entities/user.entity';
import { ClassifiedCategory } from './entities/classified-category.entity';
import { ClassifiedFavorite } from './entities/classified-favorite.entity';
import { ClassifiedListingImage } from './entities/classified-listing-image.entity';
import {
  ClassifiedCondition,
  ClassifiedListing,
  ClassifiedListingStatus,
  ClassifiedPriceType,
} from './entities/classified-listing.entity';

const LISTING_STATUSES: ClassifiedListingStatus[] = [
  'DRAFT',
  'PUBLISHED',
  'PAUSED',
  'SOLD',
  'ARCHIVED',
  'PENDING_REVIEW',
];
const PRICE_TYPES: ClassifiedPriceType[] = ['FIXED', 'NEGOTIABLE', 'CONTACT'];
const CONDITIONS: ClassifiedCondition[] = ['NEW', 'USED', 'REFURBISHED', 'NOT_APPLICABLE'];

@Injectable()
export class ClassifiedsService {
  constructor(
    @InjectRepository(ClassifiedCategory)
    private readonly categoriesRepo: Repository<ClassifiedCategory>,
    @InjectRepository(ClassifiedListing)
    private readonly listingsRepo: Repository<ClassifiedListing>,
    @InjectRepository(ClassifiedListingImage)
    private readonly imagesRepo: Repository<ClassifiedListingImage>,
    @InjectRepository(ClassifiedFavorite)
    private readonly favoritesRepo: Repository<ClassifiedFavorite>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Company)
    private readonly companiesRepo: Repository<Company>,
  ) {}

  async categories() {
    return this.categoriesRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async search(params: Record<string, unknown>) {
    const page = clampInt(params.page, 1, 10_000, 1);
    const limit = clampInt(params.limit, 1, 60, 24);
    const query = this.listingsRepo
      .createQueryBuilder('listing')
      .where('listing.status = :status', { status: 'PUBLISHED' });

    const q = cleanText(params.q, 120).toLowerCase();
    if (q) {
      query.andWhere(
        '(LOWER(listing.title) LIKE :q OR LOWER(listing.description) LIKE :q)',
        { q: `%${q}%` },
      );
    }

    const category = cleanText(params.category, 80);
    if (category) query.andWhere('listing.categorySlug = :category', { category });

    const city = cleanText(params.city, 120).toLowerCase();
    if (city) query.andWhere('LOWER(listing.city) LIKE :city', { city: `%${city}%` });

    const state = cleanText(params.state, 2).toUpperCase();
    if (state) query.andWhere('listing.state = :state', { state });

    const condition = cleanText(params.condition, 24).toUpperCase();
    if (CONDITIONS.includes(condition as ClassifiedCondition)) {
      query.andWhere('listing.condition = :condition', { condition });
    }

    const minPrice = numericParam(params.minPrice);
    const maxPrice = numericParam(params.maxPrice);
    if (minPrice !== null) query.andWhere('listing.price >= :minPrice', { minPrice });
    if (maxPrice !== null) query.andWhere('listing.price <= :maxPrice', { maxPrice });

    const sellerType = cleanText(params.sellerType, 20).toLowerCase();
    if (sellerType === 'company') query.andWhere('listing.companyId IS NOT NULL');
    if (sellerType === 'person') query.andWhere('listing.companyId IS NULL');

    if (String(params.featured || '') === 'true') {
      query.andWhere('listing.isFeatured = true');
    }

    const sort = cleanText(params.sort, 30).toLowerCase();
    if (sort === 'price_asc') query.orderBy('listing.price', 'ASC', 'NULLS LAST');
    else if (sort === 'price_desc') query.orderBy('listing.price', 'DESC', 'NULLS LAST');
    else if (sort === 'oldest') query.orderBy('listing.publishedAt', 'ASC');
    else {
      query.orderBy('listing.isFeatured', 'DESC').addOrderBy('listing.publishedAt', 'DESC');
    }

    query.skip((page - 1) * limit).take(limit);
    const [items, total] = await query.getManyAndCount();
    return {
      items: await this.hydrateListings(items),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getPublicBySlug(slug: string) {
    const listing = await this.listingsRepo.findOne({
      where: { slug, status: 'PUBLISHED' },
    });
    if (!listing) throw new NotFoundException('Anúncio não encontrado.');

    await this.listingsRepo.increment({ id: listing.id }, 'viewsCount', 1);
    listing.viewsCount += 1;

    const [hydrated] = await this.hydrateListings([listing]);
    const [seller, company, related] = await Promise.all([
      this.usersRepo.findOne({ where: { id: listing.sellerUserId } }),
      listing.companyId
        ? this.companiesRepo.findOne({ where: { id: listing.companyId } })
        : Promise.resolve(null),
      this.listingsRepo.find({
        where: { categorySlug: listing.categorySlug, status: 'PUBLISHED' },
        order: { isFeatured: 'DESC', publishedAt: 'DESC' },
        take: 10,
      }),
    ]);

    const relatedWithoutCurrent = related.filter((item) => item.id !== listing.id).slice(0, 8);
    return {
      ...hydrated,
      seller: {
        id: listing.companyId || listing.sellerUserId,
        type: listing.companyId ? 'COMPANY' : 'PERSON',
        name: company?.name || seller?.displayName || seller?.fullName || seller?.socialName || 'Anunciante',
        photoURL: company?.logoURL || seller?.photoURL || null,
        verified: Boolean(
          company
            ? company.verificationStatus === CompanyStatus.VERIFIED || company.isVerified
            : seller?.isVerified,
        ),
        memberSince: seller?.createdAt || null,
        city: company?.city || seller?.city || listing.city,
        state: company?.state || seller?.state || listing.state,
      },
      related: await this.hydrateListings(relatedWithoutCurrent),
    };
  }

  async mine(uid: string) {
    const items = await this.listingsRepo.find({
      where: { sellerUserId: uid },
      order: { updatedAt: 'DESC' },
    });
    return this.hydrateListings(items);
  }

  async favorites(uid: string) {
    const favoriteRows = await this.favoritesRepo.find({
      where: { userId: uid },
      order: { createdAt: 'DESC' },
    });
    if (!favoriteRows.length) return [];
    const listings = await this.listingsRepo.find({
      where: { id: In(favoriteRows.map((item) => item.listingId)), status: 'PUBLISHED' },
    });
    const rank = new Map(favoriteRows.map((item, index) => [item.listingId, index]));
    listings.sort((a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999));
    return this.hydrateListings(listings, uid);
  }

  async create(uid: string, body: Record<string, unknown>) {
    const user = await this.usersRepo.findOne({ where: { id: uid } });
    if (!user) throw new ForbiddenException('Usuário não encontrado.');

    const categorySlug = cleanText(body.categorySlug, 80);
    await this.assertCategory(categorySlug);

    const linkedCompany = user.companyId
      ? await this.companiesRepo.findOne({ where: { id: user.companyId } })
      : null;
    const company = linkedCompany && (linkedCompany.ownerId === uid || user.isCompanyAdmin)
      ? linkedCompany
      : null;

    const title = requiredText(body.title, 160, 'Informe o título do anúncio.');
    const description = requiredText(body.description, 12_000, 'Informe a descrição do anúncio.');
    const city = requiredText(body.city || user.city || company?.city, 120, 'Informe a cidade.');
    const state = requiredText(body.state || user.state || company?.state, 2, 'Informe o estado.').toUpperCase();
    const priceType = enumValue(body.priceType, PRICE_TYPES, 'FIXED');
    const condition = enumValue(body.condition, CONDITIONS, 'USED');
    const status = enumValue(body.status, LISTING_STATUSES, 'DRAFT');
    const price = priceType === 'CONTACT' ? null : money(body.price);
    if (priceType !== 'CONTACT' && price === null) {
      throw new BadRequestException('Informe um preço válido.');
    }

    const listing = this.listingsRepo.create({
      sellerUserId: uid,
      companyId: company?.id || null,
      categorySlug,
      title,
      slug: await this.uniqueSlug(title),
      description,
      price,
      priceType,
      condition,
      city,
      state,
      neighborhood: cleanNullable(body.neighborhood, 140),
      zipCode: cleanNullable(body.zipCode, 20),
      latitude: coordinate(body.latitude),
      longitude: coordinate(body.longitude),
      status,
      isFeatured: false,
      sellerVerifiedSnapshot: Boolean(
        company
          ? company.verificationStatus === CompanyStatus.VERIFIED || company.isVerified
          : user.isVerified,
      ),
      attributes: plainAttributes(body.attributes),
      contactPhone: cleanNullable(body.contactPhone || user.phone || company?.phone, 40),
      contactWhatsapp: cleanNullable(body.contactWhatsapp, 40),
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
      expiresAt: null,
    });

    const saved = await this.listingsRepo.save(listing);
    await this.replaceImages(saved.id, body.images);
    return this.getMineById(uid, saved.id);
  }

  async update(uid: string, id: string, body: Record<string, unknown>) {
    const listing = await this.assertOwner(uid, id);

    if (body.categorySlug !== undefined) {
      const categorySlug = cleanText(body.categorySlug, 80);
      await this.assertCategory(categorySlug);
      listing.categorySlug = categorySlug;
    }
    if (body.title !== undefined) listing.title = requiredText(body.title, 160, 'Informe o título.');
    if (body.description !== undefined) listing.description = requiredText(body.description, 12_000, 'Informe a descrição.');
    if (body.city !== undefined) listing.city = requiredText(body.city, 120, 'Informe a cidade.');
    if (body.state !== undefined) listing.state = requiredText(body.state, 2, 'Informe o estado.').toUpperCase();
    if (body.neighborhood !== undefined) listing.neighborhood = cleanNullable(body.neighborhood, 140);
    if (body.zipCode !== undefined) listing.zipCode = cleanNullable(body.zipCode, 20);
    if (body.latitude !== undefined) listing.latitude = coordinate(body.latitude);
    if (body.longitude !== undefined) listing.longitude = coordinate(body.longitude);
    if (body.priceType !== undefined) listing.priceType = enumValue(body.priceType, PRICE_TYPES, listing.priceType);
    if (body.condition !== undefined) listing.condition = enumValue(body.condition, CONDITIONS, listing.condition);
    if (body.price !== undefined || body.priceType !== undefined) {
      listing.price = listing.priceType === 'CONTACT' ? null : money(body.price ?? listing.price);
      if (listing.priceType !== 'CONTACT' && listing.price === null) {
        throw new BadRequestException('Informe um preço válido.');
      }
    }
    if (body.attributes !== undefined) listing.attributes = plainAttributes(body.attributes);
    if (body.contactPhone !== undefined) listing.contactPhone = cleanNullable(body.contactPhone, 40);
    if (body.contactWhatsapp !== undefined) listing.contactWhatsapp = cleanNullable(body.contactWhatsapp, 40);

    await this.listingsRepo.save(listing);
    if (Array.isArray(body.images)) await this.replaceImages(listing.id, body.images);
    return this.getMineById(uid, listing.id);
  }

  async publish(uid: string, id: string) {
    const listing = await this.assertOwner(uid, id);
    await this.assertCategory(listing.categorySlug);
    if (!listing.title || !listing.description || !listing.city || !listing.state) {
      throw new BadRequestException('Complete título, descrição e localização antes de publicar.');
    }
    listing.status = 'PUBLISHED';
    listing.publishedAt = listing.publishedAt || new Date();
    await this.listingsRepo.save(listing);
    return this.getMineById(uid, listing.id);
  }

  async setStatus(uid: string, id: string, statusRaw: unknown) {
    const listing = await this.assertOwner(uid, id);
    const status = enumValue(statusRaw, ['PAUSED', 'SOLD', 'ARCHIVED', 'DRAFT'] as ClassifiedListingStatus[], listing.status);
    listing.status = status;
    await this.listingsRepo.save(listing);
    return this.getMineById(uid, listing.id);
  }

  async toggleFavorite(uid: string, listingId: string) {
    const listing = await this.listingsRepo.findOne({ where: { id: listingId, status: 'PUBLISHED' } });
    if (!listing) throw new NotFoundException('Anúncio não encontrado.');

    const existing = await this.favoritesRepo.findOne({ where: { userId: uid, listingId } });
    let favorited = false;
    if (existing) {
      await this.favoritesRepo.remove(existing);
    } else {
      await this.favoritesRepo.save(this.favoritesRepo.create({ userId: uid, listingId }));
      favorited = true;
    }
    const favoritesCount = await this.favoritesRepo.count({ where: { listingId } });
    listing.favoritesCount = favoritesCount;
    await this.listingsRepo.save(listing);
    return { favorited, favoritesCount };
  }

  private async getMineById(uid: string, id: string) {
    const listing = await this.assertOwner(uid, id);
    const [hydrated] = await this.hydrateListings([listing], uid);
    return hydrated;
  }

  private async hydrateListings(items: ClassifiedListing[], uid?: string) {
    if (!items.length) return [];
    const ids = items.map((item) => item.id);
    const [images, favorites] = await Promise.all([
      this.imagesRepo.find({
        where: { listingId: In(ids) },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      }),
      uid
        ? this.favoritesRepo.find({ where: { userId: uid, listingId: In(ids) } })
        : Promise.resolve([]),
    ]);
    const imageMap = new Map<string, ClassifiedListingImage[]>();
    for (const image of images) {
      const current = imageMap.get(image.listingId) || [];
      current.push(image);
      imageMap.set(image.listingId, current);
    }
    const favoriteSet = new Set(favorites.map((item) => item.listingId));
    return items.map((item) => ({
      ...item,
      images: (imageMap.get(item.id) || []).map((image) => ({
        id: image.id,
        url: image.url,
        sortOrder: image.sortOrder,
        isPrimary: image.isPrimary,
      })),
      isFavorite: favoriteSet.has(item.id),
    }));
  }

  private async replaceImages(listingId: string, rawImages: unknown) {
    if (!Array.isArray(rawImages)) return;
    const urls = rawImages
      .map((item) => typeof item === 'string' ? item : (item as any)?.url)
      .map((item) => sanitizeImageUrl(item))
      .filter((item): item is string => Boolean(item))
      .slice(0, 12);
    await this.imagesRepo.delete({ listingId });
    if (!urls.length) return;
    await this.imagesRepo.save(
      urls.map((url, index) => this.imagesRepo.create({
        listingId,
        url,
        sortOrder: index,
        isPrimary: index === 0,
      })),
    );
  }

  private async assertOwner(uid: string, id: string) {
    const listing = await this.listingsRepo.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Anúncio não encontrado.');
    if (listing.sellerUserId !== uid) throw new ForbiddenException('Você não pode alterar este anúncio.');
    return listing;
  }

  private async assertCategory(slug: string) {
    if (!slug) throw new BadRequestException('Escolha uma categoria.');
    const category = await this.categoriesRepo.findOne({ where: { slug, isActive: true } });
    if (!category) throw new BadRequestException('Categoria inválida ou indisponível.');
    return category;
  }

  private async uniqueSlug(title: string) {
    const base = slugify(title).slice(0, 120) || 'anuncio';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = `${base}-${Math.random().toString(36).slice(2, 8)}`;
      const exists = await this.listingsRepo.findOne({ where: { slug } });
      if (!exists) return slug;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}

function cleanText(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function requiredText(value: unknown, max: number, message: string) {
  const text = cleanText(value, max);
  if (!text) throw new BadRequestException(message);
  return text;
}

function cleanNullable(value: unknown, max: number) {
  const text = cleanText(value, max);
  return text || null;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const normalized = String(value ?? '').trim().toUpperCase() as T;
  return allowed.includes(normalized) ? normalized : fallback;
}

function money(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 999_999_999.99) return null;
  return numeric.toFixed(2);
}

function numericParam(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function coordinate(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : null;
}

function plainAttributes(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 60);
  const output: Record<string, string | number | boolean | null> = {};
  for (const [rawKey, rawValue] of entries) {
    const key = cleanText(rawKey, 80);
    if (!key) continue;
    if (rawValue === null || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      output[key] = rawValue as number | boolean | null;
    } else {
      output[key] = cleanText(rawValue, 500);
    }
  }
  return output;
}

function sanitizeImageUrl(value: unknown) {
  const url = cleanText(value, 2200);
  if (!url) return null;
  if (/^(https?:\/\/|\/)/i.test(url)) return url;
  return null;
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
