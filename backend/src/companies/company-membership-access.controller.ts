import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FirebaseAuthGuard } from '../auth/auth.guard';

const EMPTY_PERMISSIONS = {
  companyProfile: false,
  recruitment: false,
  marketplace: false,
  finance: false,
  team: false,
};

const FULL_PERMISSIONS = {
  companyProfile: true,
  recruitment: true,
  marketplace: true,
  finance: true,
  team: true,
};

type PermissionKey = keyof typeof EMPTY_PERMISSIONS;

@Controller('company-membership')
@UseGuards(FirebaseAuthGuard)
export class CompanyMembershipAccessController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('me')
  async me(@Req() req: any) {
    const user = (await this.dataSource.query(
      `SELECT id,type,"companyId","companyName","isCompanyAdmin" FROM users WHERE id=$1::varchar LIMIT 1`,
      [req.user.uid],
    ))[0];

    if (!user?.companyId) {
      return {
        linked: false,
        companyId: null,
        companyName: null,
        role: null,
        status: null,
        isOwner: false,
        permissions: { ...EMPTY_PERMISSIONS },
        hasAnyPermission: false,
      };
    }

    const company = (await this.dataSource.query(
      `SELECT id,name,"ownerId" FROM companies WHERE id=$1::uuid LIMIT 1`,
      [user.companyId],
    ))[0];

    if (!company) {
      return {
        linked: false,
        companyId: null,
        companyName: null,
        role: null,
        status: null,
        isOwner: false,
        permissions: { ...EMPTY_PERMISSIONS },
        hasAnyPermission: false,
      };
    }

    const membership = (await this.dataSource.query(
      `SELECT role,status,permissions,"isPartner" FROM company_memberships
       WHERE "companyId"=$1::uuid AND "userId"=$2::varchar
       ORDER BY "updatedAt" DESC LIMIT 1`,
      [company.id, user.id],
    ))[0];

    const isOwner = String(company.ownerId || '') === String(user.id);
    const active = !membership || membership.status === 'ACTIVE';
    const legacyAdmin = user.isCompanyAdmin === true;
    const rawPermissions = membership?.permissions && typeof membership.permissions === 'object'
      ? membership.permissions
      : isOwner || legacyAdmin
        ? FULL_PERMISSIONS
        : EMPTY_PERMISSIONS;

    const permissions = { ...EMPTY_PERMISSIONS };
    for (const key of Object.keys(permissions) as PermissionKey[]) {
      permissions[key] = active && (isOwner || rawPermissions?.[key] === true);
    }

    return {
      linked: true,
      companyId: String(company.id),
      companyName: company.name || user.companyName || null,
      role: isOwner ? 'PRIMARY_ADMIN' : membership?.role || (legacyAdmin ? 'ADMIN' : 'EMPLOYEE'),
      status: membership?.status || 'ACTIVE',
      isOwner,
      isPartner: Boolean(membership?.isPartner),
      permissions,
      hasAnyPermission: active && Object.values(permissions).some(Boolean),
    };
  }

  @Delete(':companyId/members/:userId')
  async removeMember(
    @Req() req: any,
    @Param('companyId') companyId: string,
    @Param('userId') userId: string,
  ) {
    const [actor, company] = await Promise.all([
      this.dataSource.query(
        `SELECT id,type,"companyId","isCompanyAdmin" FROM users WHERE id=$1::varchar LIMIT 1`,
        [req.user.uid],
      ).then((rows) => rows[0]),
      this.dataSource.query(
        `SELECT id,name,"ownerId" FROM companies WHERE id=$1::uuid LIMIT 1`,
        [companyId],
      ).then((rows) => rows[0]),
    ]);

    if (!company) throw new NotFoundException('Empresa não encontrada.');
    if (String(company.ownerId || '') === String(userId)) {
      throw new ForbiddenException('O proprietário principal não pode ser removido da empresa.');
    }

    let allowed = actor?.type === 'ADMIN' || String(company.ownerId || '') === String(req.user.uid);
    if (!allowed) {
      const actorMembership = (await this.dataSource.query(
        `SELECT role,status,permissions FROM company_memberships
         WHERE "companyId"=$1::uuid AND "userId"=$2::varchar LIMIT 1`,
        [companyId, req.user.uid],
      ))[0];
      allowed = actorMembership?.status === 'ACTIVE'
        && (actorMembership.role === 'PRIMARY_ADMIN'
          || actorMembership.role === 'ADMIN'
          || actorMembership.permissions?.team === true);
    }
    if (!allowed) throw new ForbiddenException('Você não tem permissão para remover pessoas desta empresa.');

    const target = (await this.dataSource.query(
      `SELECT id,"companyId" FROM users WHERE id=$1::varchar LIMIT 1`,
      [userId],
    ))[0];
    if (!target) throw new NotFoundException('Usuário não encontrado.');

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE company_memberships SET status='REVOKED',permissions=$3::jsonb,"updatedAt"=now()
         WHERE "companyId"=$1::uuid AND "userId"=$2::varchar`,
        [companyId, userId, JSON.stringify(EMPTY_PERMISSIONS)],
      );
      await manager.query(
        `UPDATE users SET "companyId"=NULL,"companyName"=NULL,"isCompanyAdmin"=false,"updatedAt"=now()
         WHERE id=$1::varchar AND "companyId"=$2::varchar`,
        [userId, companyId],
      );
    });

    return { success: true, removedUserId: userId };
  }
}
