import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FirebaseAuthGuard } from '../auth/auth.guard';
import { AdminGuard } from './admin.guard';

type CompanyRole = 'PRIMARY_ADMIN' | 'ADMIN' | 'EMPLOYEE';
type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

type PermissionKey = 'companyProfile' | 'recruitment' | 'marketplace' | 'finance' | 'team';
const PERMISSION_KEYS: PermissionKey[] = ['companyProfile', 'recruitment', 'marketplace', 'finance', 'team'];
const FULL_PERMISSIONS = {
  companyProfile: true,
  recruitment: true,
  marketplace: true,
  finance: true,
  team: true,
};
const EMPLOYEE_PERMISSIONS = {
  companyProfile: false,
  recruitment: false,
  marketplace: false,
  finance: false,
  team: false,
};

@Controller('admin/companies/:companyId/members')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminCompanyMembersController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async list(@Param('companyId') companyId: string) {
    const company = await this.company(companyId);
    await this.bootstrapLegacyMemberships(company);
    return this.members(companyId);
  }

  @Post()
  async add(
    @Param('companyId') companyId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const company = await this.company(companyId);
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) throw new BadRequestException('Informe o e-mail do usuário que será vinculado.');

    const users = await this.dataSource.query(
      `SELECT id,email,"displayName","fullName","socialName" FROM users WHERE lower(email)=lower($1::text) LIMIT 1`,
      [email],
    );
    const user = users[0];
    if (!user) throw new NotFoundException('Nenhum usuário cadastrado foi encontrado com esse e-mail.');

    const role = this.role(body.role, 'EMPLOYEE');
    if (role === 'PRIMARY_ADMIN' && user.id !== company.ownerId) {
      throw new BadRequestException('Use “Tornar proprietário” para definir o administrador principal.');
    }
    const permissions = this.permissions(body.permissions, role === 'EMPLOYEE' ? EMPLOYEE_PERMISSIONS : FULL_PERMISSIONS);
    const isPartner = body.isPartner === true;

    await this.dataSource.query(
      `INSERT INTO company_memberships("companyId","userId",role,"isPartner",permissions,status)
       VALUES ($1::uuid,$2::varchar,$3::varchar,$4::boolean,$5::jsonb,'ACTIVE')
       ON CONFLICT ("companyId","userId") DO UPDATE SET
         role=EXCLUDED.role,
         "isPartner"=EXCLUDED."isPartner",
         permissions=EXCLUDED.permissions,
         status='ACTIVE',
         "updatedAt"=now()`,
      [companyId, user.id, role, isPartner, JSON.stringify(permissions)],
    );
    await this.syncLegacyUser(user.id, company, role, 'ACTIVE');
    return this.members(companyId);
  }

  @Put(':userId')
  async update(
    @Param('companyId') companyId: string,
    @Param('userId') userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const company = await this.company(companyId);
    await this.bootstrapLegacyMemberships(company);
    const existing = (await this.dataSource.query(
      `SELECT * FROM company_memberships WHERE "companyId"=$1::uuid AND "userId"=$2::varchar LIMIT 1`,
      [companyId, userId],
    ))[0];
    if (!existing) throw new NotFoundException('Vínculo empresarial não encontrado.');

    const owner = company.ownerId === userId;
    const role = owner ? 'PRIMARY_ADMIN' : this.role(body.role, existing.role as CompanyRole);
    if (!owner && role === 'PRIMARY_ADMIN') {
      throw new BadRequestException('Use “Tornar proprietário” para transferir a administração principal.');
    }
    const status = owner ? 'ACTIVE' : this.status(body.status, existing.status as MembershipStatus);
    const isPartner = body.isPartner === undefined ? Boolean(existing.isPartner) : body.isPartner === true;
    const permissions = owner ? FULL_PERMISSIONS : this.permissions(body.permissions, existing.permissions || EMPLOYEE_PERMISSIONS);

    await this.dataSource.query(
      `UPDATE company_memberships SET
         role=$3::varchar,"isPartner"=$4::boolean,permissions=$5::jsonb,status=$6::varchar,"updatedAt"=now()
       WHERE "companyId"=$1::uuid AND "userId"=$2::varchar`,
      [companyId, userId, role, isPartner, JSON.stringify(permissions), status],
    );
    await this.syncLegacyUser(userId, company, role, status);
    return this.members(companyId);
  }

  @Put(':userId/owner')
  async makeOwner(
    @Param('companyId') companyId: string,
    @Param('userId') userId: string,
  ) {
    const company = await this.company(companyId);
    await this.bootstrapLegacyMemberships(company);
    const target = (await this.dataSource.query(
      `SELECT * FROM company_memberships WHERE "companyId"=$1::uuid AND "userId"=$2::varchar LIMIT 1`,
      [companyId, userId],
    ))[0];
    if (!target || target.status !== 'ACTIVE') {
      throw new BadRequestException('O novo proprietário precisa ter um vínculo ativo com a empresa.');
    }
    if (company.ownerId === userId) return this.members(companyId);

    const oldOwnerId = company.ownerId;
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE company_memberships
         SET role='ADMIN',permissions=$2::jsonb,"updatedAt"=now()
         WHERE "companyId"=$1::uuid AND role='PRIMARY_ADMIN' AND status='ACTIVE'`,
        [companyId, JSON.stringify(FULL_PERMISSIONS)],
      );
      await manager.query(
        `UPDATE company_memberships
         SET role='PRIMARY_ADMIN',"isPartner"=true,permissions=$3::jsonb,status='ACTIVE',"updatedAt"=now()
         WHERE "companyId"=$1::uuid AND "userId"=$2::varchar`,
        [companyId, userId, JSON.stringify(FULL_PERMISSIONS)],
      );
      await manager.query(
        `UPDATE companies SET "ownerId"=$2::varchar,"updatedAt"=now() WHERE id=$1::uuid`,
        [companyId, userId],
      );
      await manager.query(
        `UPDATE users SET "companyId"=$2::varchar,"companyName"=$3::text,"isCompanyAdmin"=true,"updatedAt"=now() WHERE id=$1::varchar`,
        [userId, companyId, company.name],
      );
      if (oldOwnerId && oldOwnerId !== userId) {
        await manager.query(
          `UPDATE users SET "companyId"=$2::varchar,"companyName"=$3::text,"isCompanyAdmin"=true,"updatedAt"=now() WHERE id=$1::varchar`,
          [oldOwnerId, companyId, company.name],
        );
      }
    });
    return this.members(companyId);
  }

  private async company(companyId: string) {
    const rows = await this.dataSource.query(
      `SELECT id,name,"ownerId" FROM companies WHERE id=$1::uuid LIMIT 1`,
      [companyId],
    );
    if (!rows[0]) throw new NotFoundException('Empresa não encontrada.');
    return rows[0];
  }

  private async bootstrapLegacyMemberships(company: any) {
    const companyId = String(company.id);
    const ownerId = company.ownerId ? String(company.ownerId) : null;
    await this.dataSource.transaction(async (manager) => {
      if (ownerId) {
        await manager.query(
          `UPDATE company_memberships SET role='ADMIN',"updatedAt"=now()
           WHERE "companyId"=$1::uuid AND role='PRIMARY_ADMIN' AND status='ACTIVE' AND "userId"<>$2::varchar`,
          [companyId, ownerId],
        );
        await manager.query(
          `INSERT INTO company_memberships("companyId","userId",role,"isPartner",permissions,status)
           VALUES ($1::uuid,$2::varchar,'PRIMARY_ADMIN',false,$3::jsonb,'ACTIVE')
           ON CONFLICT ("companyId","userId") DO UPDATE SET
             role='PRIMARY_ADMIN',status='ACTIVE',permissions=$3::jsonb,"updatedAt"=now()`,
          [companyId, ownerId, JSON.stringify(FULL_PERMISSIONS)],
        );
      }

      // company_memberships.companyId is UUID, while the legacy users.companyId column is varchar.
      // Keep them as different bind parameters so PostgreSQL never has to infer one $n as both uuid and text.
      await manager.query(
        `INSERT INTO company_memberships("companyId","userId",role,"isPartner",permissions,status)
         SELECT $1::uuid,u.id,
                CASE WHEN u."isCompanyAdmin"=true THEN 'ADMIN' ELSE 'EMPLOYEE' END,
                false,
                CASE WHEN u."isCompanyAdmin"=true THEN $2::jsonb ELSE $3::jsonb END,
                'ACTIVE'
         FROM users u
         WHERE u."companyId"=$5::varchar AND ($4::varchar IS NULL OR u.id<>$4::varchar)
         ON CONFLICT ("companyId","userId") DO NOTHING`,
        [
          companyId,
          JSON.stringify(FULL_PERMISSIONS),
          JSON.stringify(EMPLOYEE_PERMISSIONS),
          ownerId,
          companyId,
        ],
      );
    });
  }

  private async members(companyId: string) {
    return this.dataSource.query(
      `SELECT
         m."userId" AS id,
         u.email,u."displayName",u."fullName",u."socialName",u.phone,u."photoURL",
         m.role,m."isPartner",m.permissions,m.status,m."createdAt",m."updatedAt",
         (c."ownerId"=m."userId") AS "isOwner"
       FROM company_memberships m
       JOIN users u ON u.id=m."userId"
       JOIN companies c ON c.id=m."companyId"
       WHERE m."companyId"=$1::uuid
       ORDER BY (c."ownerId"=m."userId") DESC,
                CASE m.role WHEN 'PRIMARY_ADMIN' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,
                COALESCE(u."displayName",u."fullName",u."socialName",u.email) ASC`,
      [companyId],
    );
  }

  private async syncLegacyUser(userId: string, company: any, role: CompanyRole, status: MembershipStatus) {
    if (status === 'ACTIVE') {
      await this.dataSource.query(
        `UPDATE users SET "companyId"=$2::varchar,"companyName"=$3::text,"isCompanyAdmin"=$4::boolean,"updatedAt"=now() WHERE id=$1::varchar`,
        [userId, String(company.id), company.name, role === 'PRIMARY_ADMIN' || role === 'ADMIN'],
      );
      return;
    }
    await this.dataSource.query(
      `UPDATE users SET "companyId"=NULL,"companyName"=NULL,"isCompanyAdmin"=false,"updatedAt"=now()
       WHERE id=$1::varchar AND "companyId"=$2::varchar`,
      [userId, String(company.id)],
    );
  }

  private role(value: unknown, fallback: CompanyRole): CompanyRole {
    const role = String(value || fallback).toUpperCase();
    if (!['PRIMARY_ADMIN', 'ADMIN', 'EMPLOYEE'].includes(role)) throw new BadRequestException('Papel empresarial inválido.');
    return role as CompanyRole;
  }

  private status(value: unknown, fallback: MembershipStatus): MembershipStatus {
    const status = String(value || fallback).toUpperCase();
    if (!['ACTIVE', 'SUSPENDED', 'REVOKED'].includes(status)) throw new BadRequestException('Status do vínculo inválido.');
    return status as MembershipStatus;
  }

  private permissions(value: unknown, fallback: Record<string, boolean>) {
    const source = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : fallback;
    const result: Record<PermissionKey, boolean> = { ...EMPLOYEE_PERMISSIONS };
    for (const key of PERMISSION_KEYS) {
      result[key] = source[key] === undefined ? Boolean(fallback[key]) : source[key] === true;
    }
    return result;
  }
}
