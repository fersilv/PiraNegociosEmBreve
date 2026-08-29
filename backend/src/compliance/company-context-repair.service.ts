import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CompanyContextRepairService {
  constructor(private readonly dataSource: DataSource) {}

  async repair(uid: string) {
    const users = await this.dataSource.query(
      `SELECT id,"companyId","isCompanyAdmin" FROM users WHERE id=$1 LIMIT 1`,
      [uid],
    );
    const user = users[0];
    if (!user) return null;

    let company: any = null;
    let membership: any = null;

    if (user.companyId) {
      company = (await this.dataSource.query(
        `SELECT id,name,"ownerId" FROM companies WHERE id=$1 LIMIT 1`,
        [user.companyId],
      ))[0] || null;
      if (company) {
        membership = (await this.dataSource.query(
          `SELECT role,permissions,status,"isPartner" FROM company_memberships WHERE "companyId"=$1 AND "userId"=$2 LIMIT 1`,
          [company.id, uid],
        ).catch(() => []))[0] || null;
      }
    }

    if (!company) {
      company = (await this.dataSource.query(
        `SELECT id,name,"ownerId" FROM companies WHERE "ownerId"=$1 ORDER BY "updatedAt" DESC LIMIT 1`,
        [uid],
      ))[0] || null;
    }

    if (!company) {
      const rows = await this.dataSource.query(
        `SELECT c.id,c.name,c."ownerId",m.role,m.permissions,m.status,m."isPartner"
         FROM company_memberships m
         JOIN companies c ON c.id=m."companyId"
         WHERE m."userId"=$1 AND m.status='ACTIVE'
         ORDER BY CASE m.role WHEN 'PRIMARY_ADMIN' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,m."updatedAt" DESC
         LIMIT 1`,
        [uid],
      ).catch(() => []);
      if (rows[0]) {
        company = rows[0];
        membership = rows[0];
      }
    }

    if (!company) return null;

    if (!membership) {
      membership = (await this.dataSource.query(
        `SELECT role,permissions,status,"isPartner" FROM company_memberships WHERE "companyId"=$1 AND "userId"=$2 LIMIT 1`,
        [company.id, uid],
      ).catch(() => []))[0] || null;
    }

    const owner = company.ownerId === uid;
    const activeAdmin = membership?.status === 'ACTIVE' && ['PRIMARY_ADMIN', 'ADMIN'].includes(String(membership.role || ''));
    await this.dataSource.query(
      `UPDATE users
       SET "companyId"=$2,"companyName"=$3,"isCompanyAdmin"=$4,"updatedAt"=now()
       WHERE id=$1`,
      [uid, company.id, company.name, owner || activeAdmin],
    );

    return {
      companyId: company.id,
      companyName: company.name,
      owner,
      membership,
    };
  }
}
