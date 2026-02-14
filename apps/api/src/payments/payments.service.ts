import { Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class PaymentsService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  async create(body: any) {
    const { leaseId, paidAt, amountCents, method, note } = body || {};
    if (!leaseId || !paidAt || typeof amountCents !== 'number') {
      throw new BadRequestException('Missing leaseId/paidAt/amountCents');
    }

    const r = await this.pool.query(
      `INSERT INTO payments (lease_id, paid_at, amount_cents, method, note)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [leaseId, paidAt, amountCents, method || 'virement', note || null]
    );
    return r.rows[0];
  }

  async list(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    const r = await this.pool.query(
      `SELECT * FROM payments WHERE lease_id=$1 ORDER BY paid_at DESC, created_at DESC`,
      [leaseId]
    );
    return r.rows;
  }
}
