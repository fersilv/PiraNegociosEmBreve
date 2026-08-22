import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ProductDurationService {
  constructor(private readonly dataSource: DataSource) {}

  async update(code: string, rawDays: number) {
    const days = Math.round(Number(rawDays));
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      throw new BadRequestException('A duração deve ficar entre 1 e 3650 dias.');
    }
    const rows = await this.dataSource.query(
      `UPDATE payment_products SET "durationDays" = $2, "updatedAt" = now() WHERE code = $1 RETURNING *`,
      [code, days],
    );
    if (!rows[0]) throw new NotFoundException('Produto não encontrado.');
    return rows[0];
  }
}
