import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { companyScopeCapability } from './company-mcp.scopes';

type Permissions = {
  companyProfile: boolean;
  marketplace: boolean;
  recruitment: boolean;
  finance: boolean;
  team: boolean;
};

@Injectable()
export class CompanyMcpLiveAccessService {
  constructor(private readonly dataSource: DataSource) {}

  async validate(companyId: string, userId: string, tokenScopes: string[]) {
    const [userRows, companyRows, membershipRows] = await Promise.all([
      this.dataSource.query(`SELECT id,"companyId","isCompanyAdmin" FROM users WHERE id=$1 LIMIT 1`, [userId]),
      this.dataSource.query(`SELECT id,name,"ownerId" FROM companies WHERE id=$1::uuid LIMIT 1`, [companyId]),
      this.dataSource.query(
        `SELECT role,status,permissions FROM company_memberships
         WHERE "companyId"=$1::uuid AND "userId"=$2 AND status='ACTIVE' LIMIT 1`,
        [companyId, userId],
      ),
    ]);
    const user = userRows[0];
    const company = companyRows[0];
    const membership = membershipRows[0];
    if (!user || !company) throw new UnauthorizedException('O vínculo empresarial desta conexão não existe mais.');

    const owner = String(company.ownerId || '') === String(userId);
    const legacyAdmin = user.isCompanyAdmin === true && String(user.companyId || '') === String(companyId);
    const elevated = owner || legacyAdmin || membership?.role === 'PRIMARY_ADMIN' || membership?.role === 'ADMIN';
    const raw = membership?.permissions && typeof membership.permissions === 'object' ? membership.permissions : {};
    const permissions: Permissions = {
      companyProfile: elevated || raw.companyProfile === true,
      marketplace: elevated || raw.marketplace === true,
      recruitment: elevated || raw.recruitment === true,
      finance: elevated || raw.finance === true,
      team: elevated || raw.team === true,
    };
    const hasAny = elevated || Object.values(permissions).some(Boolean);
    if (!hasAny) throw new UnauthorizedException('O usuário não possui mais autorização nesta empresa.');

    const scopes = Array.from(new Set(tokenScopes.filter((scope) => {
      const capability = companyScopeCapability(scope);
      if (!capability) return false;
      if (scope === 'company:read' || scope === 'analytics:reports:run') return hasAny;
      if (!capability.permission) return hasAny;
      return elevated || permissions[capability.permission] === true;
    })));
    if (!scopes.length) throw new UnauthorizedException('A conexão não possui mais permissões válidas para esta empresa.');

    return {
      company: { id: String(company.id), name: String(company.name || 'Empresa') },
      permissions,
      scopes,
    };
  }
}
