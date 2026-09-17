import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { CompanyPage } from './entities/company-page.entity';

export const COMPANY_SITE_TYPES = ['store','institutional','services','careers'] as const;
type CompanySiteType = typeof COMPANY_SITE_TYPES[number];
type AnyConfig = Record<string, any>;
const MAX_CONFIG_BYTES = 160_000;
const COMMERCE_LEGACY = new Set(['vitrine','bazar','portal','loja','marketplace','catalogo','classificados-pro','mercado','gazeta','mosaico','radar','pregao']);
const DAYS = ['mon','tue','wed','thu','fri','sat','sun'] as const;

@Injectable()
export class CompanyPagesService {
  constructor(@InjectRepository(CompanyPage) private readonly pages: Repository<CompanyPage>) {}

  defaultConfig(_company: Company): AnyConfig { return { version: 3, siteType: 'institutional' }; }

  async getForCompany(company: Company) {
    const existing = await this.pages.findOne({ where: { companyId: company.id } });
    if (!existing) {
      const draft=this.defaultConfig(company);
      return { companyId:company.id, siteType:'institutional', draft, published:null, status:'DRAFT' as const, revision:1, publishedAt:null, validation:this.validate(draft,company) };
    }
    const draft=this.normalizeConfig(existing.draft,company,existing.siteType);
    const published=existing.published?this.normalizeConfig(existing.published,company,existing.siteType):null;
    return {...existing,siteType:this.resolveSiteType(draft.siteType||existing.siteType),draft,published,validation:this.validate(draft,company)};
  }

  async saveDraft(company: Company, rawConfig: unknown) {
    const config=this.normalizeConfig(rawConfig,company);
    const validation=this.validate(config,company);
    let page=await this.pages.findOne({where:{companyId:company.id}});
    if(!page) page=this.pages.create({companyId:company.id,siteType:config.siteType,draft:config,published:null,status:'DRAFT',revision:1,publishedAt:null});
    else { page.siteType=config.siteType; page.draft=config; }
    const saved=await this.pages.save(page);
    return {...saved,siteType:config.siteType,draft:config,validation};
  }

  async publish(company: Company, rawConfig?: unknown) {
    const existing=await this.pages.findOne({where:{companyId:company.id}});
    const config=this.normalizeConfig(rawConfig && typeof rawConfig==='object' ? rawConfig : existing?.draft || this.defaultConfig(company),company,existing?.siteType);
    const validation=this.validate(config,company);
    if(!validation.valid) throw new BadRequestException({message:'O site ainda não pode ser publicado.',...validation});
    const page=existing||this.pages.create({companyId:company.id,siteType:config.siteType,draft:config,published:null,status:'DRAFT',revision:1,publishedAt:null});
    page.siteType=config.siteType; page.draft=config; page.published=config; page.status='PUBLISHED'; page.publishedAt=new Date(); page.revision=existing?.published ? Number(existing.revision||1)+1 : Math.max(1,Number(existing?.revision||1));
    const saved=await this.pages.save(page);
    return {...saved,siteType:config.siteType,draft:config,published:config,validation};
  }

  async unpublish(company: Company) {
    const page=await this.pages.findOne({where:{companyId:company.id}}); if(!page) return this.getForCompany(company);
    page.status='DRAFT'; page.published=null; page.publishedAt=null; const saved=await this.pages.save(page); return {...saved,draft:this.normalizeConfig(saved.draft,company,saved.siteType),validation:this.validate(saved.draft,company)};
  }

  validate(rawConfig: unknown, company: Company) {
    const config=this.normalizeConfig(rawConfig,company);
    const warnings:string[]=[];
    if(!company.name) warnings.push('Cadastre o nome da empresa.');
    if(!company.phone) warnings.push('Cadastre um telefone da empresa.');
    if(!company.address || !company.city || !company.state) warnings.push('Complete o endereço da empresa antes de publicar.');
    return { valid:warnings.length===0, warnings, siteType:config.siteType };
  }

  normalizeConfig(rawConfig: unknown, company: Company, fallbackType?: string): AnyConfig {
    const input=rawConfig && typeof rawConfig==='object' && !Array.isArray(rawConfig) ? JSON.parse(JSON.stringify(rawConfig)) : {};
    if(Buffer.byteLength(JSON.stringify(input),'utf8')>MAX_CONFIG_BYTES) throw new BadRequestException('A configuração do site ficou grande demais.');
    const siteType=this.resolveSiteType(input.siteType||input.templateKey||fallbackType);
    const output:AnyConfig={version:3,siteType};
    const whatsapp=String(input.whatsapp || input.contacts?.whatsapp || '').trim().slice(0,40); if(whatsapp) output.whatsapp=whatsapp;
    const businessHours=this.normalizeBusinessHours(input.businessHours); if(businessHours) output.businessHours=businessHours;
    const legal=this.normalizeLegal(input.legal); if(legal) output.legal=legal;
    return output;
  }

  private resolveSiteType(value: unknown): CompanySiteType { const raw=String(value||'').trim().toLowerCase(); if(COMMERCE_LEGACY.has(raw))return 'store'; return COMPANY_SITE_TYPES.includes(raw as CompanySiteType)?raw as CompanySiteType:'institutional'; }
  private normalizeBusinessHours(raw: unknown) { if(!raw||typeof raw!=='object'||Array.isArray(raw))return null; const input=raw as AnyConfig; const days:AnyConfig={}; for(const day of DAYS){const rows=Array.isArray(input.days?.[day])?input.days[day].slice(0,6):[];days[day]=rows.map((x:AnyConfig)=>({open:this.time(x?.open),close:this.time(x?.close)})).filter((x:AnyConfig)=>x.open&&x.close);} const specialDates=(Array.isArray(input.specialDates)?input.specialDates:[]).slice(0,60).map((x:AnyConfig)=>({date:String(x?.date||'').slice(0,10),label:String(x?.label||'').slice(0,80)||undefined,closed:Boolean(x?.closed),open:this.time(x?.open)||undefined,close:this.time(x?.close)||undefined})).filter((x:AnyConfig)=>/^\d{4}-\d{2}-\d{2}$/.test(x.date)); return {enabled:input.enabled===true,showOnPage:input.showOnPage!==false,timezone:String(input.timezone||'America/Sao_Paulo').slice(0,80),days,specialDates}; }
  private normalizeLegal(raw: unknown) { if(!raw||typeof raw!=='object'||Array.isArray(raw))return null; const x=raw as AnyConfig; const clean=(v:any,n:number)=>String(v||'').slice(0,n); return {termsEnabled:x.termsEnabled===true,termsTitle:clean(x.termsTitle||'Termos de uso',120),termsBody:clean(x.termsBody,60000),privacyEnabled:x.privacyEnabled===true,privacyTitle:clean(x.privacyTitle||'Política de privacidade',120),privacyBody:clean(x.privacyBody,60000)}; }
  private time(value:any){const text=String(value||'');return /^([01]\d|2[0-3]):[0-5]\d$/.test(text)?text:'';}
}
