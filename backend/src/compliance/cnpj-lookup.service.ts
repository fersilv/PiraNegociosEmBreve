import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

type QsaMember = {
  name: string;
  maskedDocument: string | null;
  qualification: string | null;
  joinedAt: string | null;
};

export type PublicCnpjSnapshot = {
  cnpj: string;
  legalName: string;
  tradeName: string | null;
  situation: string | null;
  legalAddress: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  email: string | null;
  phone: string | null;
  mainActivity: string | null;
  qsa: QsaMember[];
  source: 'BRASILAPI' | 'CNPJWS';
  sourceUpdatedAt: string | null;
  checkedAt: string;
};

@Injectable()
export class CnpjLookupService {
  constructor(private readonly dataSource: DataSource) {}

  async lookup(raw: string): Promise<PublicCnpjSnapshot> {
    const cnpj = this.normalize(raw);
    const brasil = await this.fromBrasilApi(cnpj).catch(() => null);
    if (brasil) return brasil;
    const cnpjws = await this.fromCnpjWs(cnpj).catch(() => null);
    if (cnpjws) return cnpjws;
    throw new ServiceUnavailableException('Não foi possível consultar o CNPJ agora. Tente novamente em alguns instantes.');
  }

  async applyToCompany(companyId: string, snapshot: PublicCnpjSnapshot) {
    const currentRows = await this.dataSource.query(
      `SELECT id,name,cnpj,address,city,state,"legalName","legalAddress","legalCity","legalState","legalZipCode","cnpjSnapshot","commercialAddressSameAsLegal"
       FROM companies WHERE id=$1 LIMIT 1`,
      [companyId],
    );
    const current = currentRows[0];
    if (!current) throw new BadRequestException('Empresa não encontrada.');

    const previous = current.cnpjSnapshot || null;
    const changes = previous ? this.detectImportantChanges(previous, snapshot) : [];
    const changeAlert = changes.length ? { detectedAt: new Date().toISOString(), changes } : null;
    const commercialSame = current.commercialAddressSameAsLegal !== false;

    const rows = await this.dataSource.query(
      `UPDATE companies SET
         "hasCnpj"=true,
         cnpj=$2,
         "legalName"=$3,
         "registryTradeName"=$4,
         "legalAddress"=$5,
         "legalCity"=$6,
         "legalState"=$7,
         "legalZipCode"=$8,
         "cnpjSituation"=$9,
         "cnpjDataSource"=$10,
         "cnpjDataCheckedAt"=now(),
         "cnpjDataUpdatedAt"=$11,
         "cnpjSnapshot"=$12::jsonb,
         "cnpjChangeAlert"=$13::jsonb,
         address=CASE WHEN $14 THEN $5 ELSE address END,
         city=CASE WHEN $14 THEN $6 ELSE city END,
         state=CASE WHEN $14 THEN $7 ELSE state END,
         "cityState"=CASE WHEN $14 THEN concat_ws(', ',NULLIF($6,''),NULLIF($7,'')) ELSE "cityState" END,
         "updatedAt"=now()
       WHERE id=$1 RETURNING *`,
      [
        companyId,
        snapshot.cnpj,
        snapshot.legalName,
        snapshot.tradeName,
        snapshot.legalAddress,
        snapshot.city,
        snapshot.state,
        snapshot.zipCode,
        snapshot.situation,
        snapshot.source,
        snapshot.sourceUpdatedAt,
        JSON.stringify(snapshot),
        JSON.stringify(changeAlert),
        commercialSame,
      ],
    );
    return { company: rows[0], changes };
  }

  normalize(value: string) {
    const cnpj = String(value || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) {
      throw new BadRequestException('Informe um CNPJ válido com 14 caracteres.');
    }
    return cnpj;
  }

  private async fromBrasilApi(cnpj: string): Promise<PublicCnpjSnapshot> {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(cnpj)}`, {
      headers: { accept: 'application/json', 'user-agent': 'PiraNegocios/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`BrasilAPI ${response.status}`);
    const data: any = await response.json();
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
      qsa: Array.isArray(data.qsa) ? data.qsa.map((item: any) => ({
        name: String(item.nome_socio || '').trim(),
        maskedDocument: String(item.cnpj_cpf_do_socio || '').trim() || null,
        qualification: String(item.qualificacao_socio || '').trim() || null,
        joinedAt: String(item.data_entrada_sociedade || '').trim() || null,
      })).filter((item: QsaMember) => item.name) : [],
      source: 'BRASILAPI',
      sourceUpdatedAt: null,
      checkedAt: new Date().toISOString(),
    };
  }

  private async fromCnpjWs(cnpj: string): Promise<PublicCnpjSnapshot> {
    const response = await fetch(`https://publica.cnpj.ws/cnpj/${encodeURIComponent(cnpj)}`, {
      headers: { accept: 'application/json', 'user-agent': 'PiraNegocios/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`CNPJws ${response.status}`);
    const data: any = await response.json();
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
      qsa: Array.isArray(data.socios) ? data.socios.map((item: any) => ({
        name: String(item.nome || '').trim(),
        maskedDocument: String(item.cpf_cnpj_socio || '').trim() || null,
        qualification: String(item.qualificacao_socio?.descricao || '').trim() || null,
        joinedAt: String(item.data_entrada || '').trim() || null,
      })).filter((item: QsaMember) => item.name) : [],
      source: 'CNPJWS',
      sourceUpdatedAt: String(data.atualizado_em || est.atualizado_em || '').trim() || null,
      checkedAt: new Date().toISOString(),
    };
  }

  private detectImportantChanges(previous: any, next: PublicCnpjSnapshot) {
    const fields: Array<[string, string, unknown, unknown]> = [
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

  private joinAddress(parts: unknown[]) {
    return parts.map((value) => String(value || '').trim()).filter(Boolean).join(', ').replace(/,\s*,/g, ',');
  }

  private phone(value: unknown) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits || null;
  }
}
