import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';

export type GuaranteeType = 'CAUTION' | 'VISALE';
export type GuaranteeStatus =
  | 'DRAFT'
  | 'READY'
  | 'SENT'
  | 'SIGNED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

@Injectable()
export class GuaranteesService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  private normalizeType(t: any): GuaranteeType {
    const v = String(t || '').toUpperCase();
    if (v === 'CAUTION' || v === 'VISALE') return v as GuaranteeType;
    throw new BadRequestException('Invalid guarantee type');
  }

  private normalizeStatus(s: any): GuaranteeStatus {
    const v = String(s || '').toUpperCase();
    const allowed: GuaranteeStatus[] = [
      'DRAFT',
      'READY',
      'SENT',
      'SIGNED',
      'REJECTED',
      'EXPIRED',
      'CANCELLED',
    ];
    if (allowed.includes(v as any)) return v as GuaranteeStatus;
    throw new BadRequestException('Invalid guarantee status');
  }

  // ✅ derive lease_id from lease_tenants (source of truth)
  private async getLeaseTenantOrThrow(leaseTenantId: string) {
    const q = await this.pool.query(
      `
      SELECT id, lease_id, tenant_id, role
      FROM lease_tenants
      WHERE id=$1
      LIMIT 1
      `,
      [leaseTenantId],
    );
    if (!q.rowCount) throw new BadRequestException('Unknown leaseTenantId');
    return q.rows[0];
  }

  async listByLease(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const q = await this.pool.query(
      `
      SELECT g.*,
             lt.tenant_id,
             lt.role,
             t.full_name AS tenant_full_name,
             t.email AS tenant_email
      FROM lease_guarantees g
      JOIN lease_tenants lt ON lt.id = g.lease_tenant_id
      JOIN tenants t ON t.id = lt.tenant_id
      WHERE g.lease_id=$1
      ORDER BY lt.created_at ASC,
               COALESCE(g.rank, 999999) ASC,
               g.created_at ASC
      `,
      [leaseId],
    );

    return { ok: true, items: q.rows };
  }

  async getOne(id: string) {
    if (!id) throw new BadRequestException('Missing id');
    const q = await this.pool.query(`SELECT * FROM lease_guarantees WHERE id=$1`, [id]);
    if (!q.rowCount) throw new NotFoundException('Guarantee not found');
    return { ok: true, item: q.rows[0] };
  }

  async create(body: any) {
    const leaseTenantId = String(body?.leaseTenantId || '').trim();
    if (!leaseTenantId) throw new BadRequestException('Missing leaseTenantId');

    const lt = await this.getLeaseTenantOrThrow(leaseTenantId);
    const type = this.normalizeType(body?.type);
    const status = body?.status ? this.normalizeStatus(body.status) : ('DRAFT' as GuaranteeStatus);

    const selected = body?.selected === true;
    const rank = body?.rank ?? null;

    // fields
    const guarantorFullName = body?.guarantorFullName ?? body?.guarantor_full_name ?? null;
    const guarantorEmail = body?.guarantorEmail ?? body?.guarantor_email ?? null;
    const guarantorPhone = body?.guarantorPhone ?? body?.guarantor_phone ?? null;

    const visaleReference = body?.visaleReference ?? body?.visale_reference ?? null;
    const visaleValidatedAt = body?.visaleValidatedAt ?? body?.visale_validated_at ?? null;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // if selected=true, deselect others for this lease_tenant
      if (selected) {
        await client.query(
          `UPDATE lease_guarantees SET selected=false
           WHERE lease_tenant_id=$1 AND selected=true`,
          [leaseTenantId],
        );
      }

      const ins = await client.query(
        `
        INSERT INTO lease_guarantees
          (lease_tenant_id, lease_id, type, status, selected, rank,
           guarantor_full_name, guarantor_email, guarantor_phone,
           visale_reference, visale_validated_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
        `,
        [
          leaseTenantId,
          lt.lease_id,
          type,
          status,
          selected,
          rank,
          guarantorFullName,
          guarantorEmail,
          guarantorPhone,
          visaleReference,
          visaleValidatedAt,
        ],
      );

      await client.query('COMMIT');
      return { ok: true, item: ins.rows[0] };
    } catch (e: any) {
      await client.query('ROLLBACK');
      // Unique selected violation -> user-friendly
      if (String(e?.message || '').includes('uniq_selected_guarantee_per_lease_tenant')) {
        throw new ConflictException('Only one selected guarantee allowed per tenant');
      }
      throw e;
    } finally {
      client.release();
    }
  }

  async update(id: string, body: any) {
    if (!id) throw new BadRequestException('Missing id');

    const existing = await this.pool.query(`SELECT * FROM lease_guarantees WHERE id=$1`, [id]);
    if (!existing.rowCount) throw new NotFoundException('Guarantee not found');

    const patch: any = {};

    if (body?.type) patch.type = this.normalizeType(body.type);
    if (body?.status) patch.status = this.normalizeStatus(body.status);
    if (body?.rank !== undefined) patch.rank = body.rank;

    // allow update fields (both naming styles)
    if (body?.guarantorFullName !== undefined || body?.guarantor_full_name !== undefined)
      patch.guarantor_full_name = body?.guarantorFullName ?? body?.guarantor_full_name ?? null;
    if (body?.guarantorEmail !== undefined || body?.guarantor_email !== undefined)
      patch.guarantor_email = body?.guarantorEmail ?? body?.guarantor_email ?? null;
    if (body?.guarantorPhone !== undefined || body?.guarantor_phone !== undefined)
      patch.guarantor_phone = body?.guarantorPhone ?? body?.guarantor_phone ?? null;

    if (body?.visaleReference !== undefined || body?.visale_reference !== undefined)
      patch.visale_reference = body?.visaleReference ?? body?.visale_reference ?? null;
    if (body?.visaleValidatedAt !== undefined || body?.visale_validated_at !== undefined)
      patch.visale_validated_at = body?.visaleValidatedAt ?? body?.visale_validated_at ?? null;

    const keys = Object.keys(patch);
    if (!keys.length) return { ok: true, item: existing.rows[0] };

    const sets = keys.map((k, i) => `${k}=$${i + 2}`).join(', ');
    const values = keys.map((k) => patch[k]);

    const q = await this.pool.query(
      `UPDATE lease_guarantees SET ${sets} WHERE id=$1 RETURNING *`,
      [id, ...values],
    );
    return { ok: true, item: q.rows[0] };
  }

  // ✅ select = true (and deselect others)
  async select(id: string) {
    if (!id) throw new BadRequestException('Missing id');

    const existing = await this.pool.query(`SELECT * FROM lease_guarantees WHERE id=$1`, [id]);
    if (!existing.rowCount) throw new NotFoundException('Guarantee not found');

    const row = existing.rows[0];
    const leaseTenantId = row.lease_tenant_id;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE lease_guarantees SET selected=false
         WHERE lease_tenant_id=$1 AND selected=true`,
        [leaseTenantId],
      );

      const upd = await client.query(
        `UPDATE lease_guarantees SET selected=true WHERE id=$1 RETURNING *`,
        [id],
      );

      await client.query('COMMIT');
      return { ok: true, item: upd.rows[0] };
    } catch (e: any) {
      await client.query('ROLLBACK');
      if (String(e?.message || '').includes('uniq_selected_guarantee_per_lease_tenant')) {
        throw new ConflictException('Only one selected guarantee allowed per tenant');
      }
      throw e;
    } finally {
      client.release();
    }
  }

  async remove(id: string) {
    if (!id) throw new BadRequestException('Missing id');
    const q = await this.pool.query(`DELETE FROM lease_guarantees WHERE id=$1 RETURNING id`, [id]);
    if (!q.rowCount) throw new NotFoundException('Guarantee not found');
    return { ok: true };
  }
}