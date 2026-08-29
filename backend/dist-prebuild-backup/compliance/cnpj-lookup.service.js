"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CnpjLookupService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const cnpj_update_typed_helper_1 = require("./cnpj-update-typed.helper");
let CnpjLookupService = class CnpjLookupService {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async lookup(raw) {
        const cnpj = this.normalize(raw);
        const brasil = await this.fromBrasilApi(cnpj).catch(() => null);
        if (brasil)
            return brasil;
        const cnpjws = await this.fromCnpjWs(cnpj).catch(() => null);
        if (cnpjws)
            return cnpjws;
        throw new common_1.ServiceUnavailableException('Não foi possível consultar o CNPJ agora. Tente novamente em alguns instantes.');
    }
    async applyToCompany(companyId, snapshot) {
        const currentRows = await this.dataSource.query(`SELECT id,name,cnpj,address,city,state,"legalName","legalAddress","legalCity","legalState","legalZipCode","cnpjSnapshot","commercialAddressSameAsLegal"
       FROM companies WHERE id=$1 LIMIT 1`, [companyId]);
        const current = currentRows[0];
        if (!current)
            throw new common_1.BadRequestException('Empresa não encontrada.');
        const previous = current.cnpjSnapshot || null;
        const changes = previous ? this.detectImportantChanges(previous, snapshot) : [];
        const changeAlert = changes.length ? { detectedAt: new Date().toISOString(), changes } : null;
        const commercialSame = current.commercialAddressSameAsLegal !== false;
        const rows = await (0, cnpj_update_typed_helper_1.applyTypedCnpjCompanyUpdate)(this.dataSource, companyId, {
            cnpj: snapshot.cnpj,
            legalName: snapshot.legalName,
            tradeName: snapshot.tradeName,
            legalAddress: snapshot.legalAddress,
            city: snapshot.city,
            state: snapshot.state,
            zipCode: snapshot.zipCode,
            situation: snapshot.situation,
            source: snapshot.source,
            sourceUpdatedAt: snapshot.sourceUpdatedAt,
            snapshot: JSON.stringify(snapshot),
            changeAlert: JSON.stringify(changeAlert),
            commercialSame,
        });
        return { company: rows[0], changes };
    }
    normalize(value) {
        const cnpj = String(value || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
        if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) {
            throw new common_1.BadRequestException('Informe um CNPJ válido com 14 caracteres.');
        }
        return cnpj;
    }
    async fromBrasilApi(cnpj) {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(cnpj)}`, {
            headers: { accept: 'application/json', 'user-agent': 'PiraNegocios/1.0' },
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok)
            throw new Error(`BrasilAPI ${response.status}`);
        const data = await response.json();
        const address = this.joinAddress([
            data.descricao_tipo_de_logradouro,
            data.logradouro,
            data.numero,
            data.complemento,
            data.bairro,
            data.municipio,
            data.uf,
            data.cep,
        ]);
        return {
            cnpj,
            legalName: String(data.razao_social || '').trim(),
            tradeName: String(data.nome_fantasia || '').trim() || null,
            situation: String(data.descricao_situacao_cadastral || data.situacao_cadastral || '').trim() || null,
            legalAddress: address,
            city: String(data.municipio || '').trim() || null,
            state: String(data.uf || '').trim().toUpperCase() || null,
            zipCode: String(data.cep || '').replace(/\D/g, '') || null,
            email: String(data.email || '').trim().toLowerCase() || null,
            phone: this.phone(data.ddd_telefone_1 || data.telefone || ''),
            mainActivity: String(data.cnae_fiscal_descricao || '').trim() || null,
            qsa: Array.isArray(data.qsa) ? data.qsa.map((item) => ({
                name: String(item.nome_socio || '').trim(),
                maskedDocument: String(item.cnpj_cpf_do_socio || '').trim() || null,
                qualification: String(item.qualificacao_socio || '').trim() || null,
                joinedAt: String(item.data_entrada_sociedade || '').trim() || null,
            })).filter((item) => item.name) : [],
            source: 'BRASILAPI',
            sourceUpdatedAt: null,
            checkedAt: new Date().toISOString(),
        };
    }
    async fromCnpjWs(cnpj) {
        const response = await fetch(`https://publica.cnpj.ws/cnpj/${encodeURIComponent(cnpj)}`, {
            headers: { accept: 'application/json', 'user-agent': 'PiraNegocios/1.0' },
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok)
            throw new Error(`CNPJws ${response.status}`);
        const data = await response.json();
        const est = data.estabelecimento || {};
        const address = this.joinAddress([
            est.tipo_logradouro,
            est.logradouro,
            est.numero,
            est.complemento,
            est.bairro,
            est.cidade?.nome,
            est.estado?.sigla,
            est.cep,
        ]);
        return {
            cnpj,
            legalName: String(data.razao_social || '').trim(),
            tradeName: String(est.nome_fantasia || '').trim() || null,
            situation: String(est.situacao_cadastral || '').trim() || null,
            legalAddress: address,
            city: String(est.cidade?.nome || '').trim() || null,
            state: String(est.estado?.sigla || '').trim().toUpperCase() || null,
            zipCode: String(est.cep || '').replace(/\D/g, '') || null,
            email: String(est.email || '').trim().toLowerCase() || null,
            phone: this.phone([est.ddd1, est.telefone1].filter(Boolean).join('')),
            mainActivity: String(est.atividade_principal?.descricao || '').trim() || null,
            qsa: Array.isArray(data.socios) ? data.socios.map((item) => ({
                name: String(item.nome || '').trim(),
                maskedDocument: String(item.cpf_cnpj_socio || '').trim() || null,
                qualification: String(item.qualificacao_socio?.descricao || '').trim() || null,
                joinedAt: String(item.data_entrada || '').trim() || null,
            })).filter((item) => item.name) : [],
            source: 'CNPJWS',
            sourceUpdatedAt: String(data.atualizado_em || est.atualizado_em || '').trim() || null,
            checkedAt: new Date().toISOString(),
        };
    }
    detectImportantChanges(previous, next) {
        const fields = [
            ['legalName', 'Razão social', previous?.legalName, next.legalName],
            ['tradeName', 'Nome fantasia cadastral', previous?.tradeName, next.tradeName],
            ['situation', 'Situação cadastral', previous?.situation, next.situation],
            ['legalAddress', 'Endereço jurídico', previous?.legalAddress, next.legalAddress],
            ['qsa', 'Quadro societário', JSON.stringify(previous?.qsa || []), JSON.stringify(next.qsa || [])],
        ];
        return fields
            .filter(([, , before, after]) => String(before ?? '') !== String(after ?? ''))
            .map(([field, label, before, after]) => ({ field, label, before, after }));
    }
    joinAddress(parts) {
        return parts.map((value) => String(value || '').trim()).filter(Boolean).join(', ').replace(/,\s*,/g, ',');
    }
    phone(value) {
        const digits = String(value || '').replace(/\D/g, '');
        return digits || null;
    }
};
exports.CnpjLookupService = CnpjLookupService;
exports.CnpjLookupService = CnpjLookupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], CnpjLookupService);
//# sourceMappingURL=cnpj-lookup.service.js.map