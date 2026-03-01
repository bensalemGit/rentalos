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

  async listByLeaseTenant(leaseTenantId: string) {
    if (!leaseTenantId) throw new BadRequestException('Missing leaseTenantId');

    const q = await this.pool.query(
      `
      SELECT lg.*,
            lt.tenant_id,
            lt.role,
            t.full_name as tenant_full_name,
            t.email as tenant_email
      FROM lease_guarantees lg
      JOIN lease_tenants lt ON lt.id = lg.lease_tenant_id
      JOIN tenants t ON t.id = lt.tenant_id
      WHERE lg.lease_tenant_id = $1
      ORDER BY lg.created_at DESC
      `,
      [leaseTenantId],
    );

    return { ok: true, items: q.rows };
  }

  async update(id: string, body: any) {
    if (!id) throw new BadRequestException('Missing id');

    const curQ = await this.pool.query(`SELECT * FROM lease_guarantees WHERE id=$1`, [id]);
    if (!curQ.rowCount) throw new BadRequestException('Guarantee not found');
    const cur = curQ.rows[0];

    // champs modifiables
    const guarantorFullName = body?.guarantorFullName ?? body?.guarantor_full_name ?? null;
    const guarantorEmail = body?.guarantorEmail ?? body?.guarantor_email ?? null;
    const guarantorPhone = body?.guarantorPhone ?? body?.guarantor_phone ?? null;
    const visaleReference = body?.visaleReference ?? body?.visale_reference ?? null;

    const selected = typeof body?.selected === 'boolean' ? body.selected : null;

    // si selected=true => unselect les autres du même lease_tenant
    if (selected === true) {
      await this.pool.query(
        `UPDATE lease_guarantees
        SET selected=false, updated_at=NOW()
        WHERE lease_tenant_id=$1 AND id <> $2`,
        [cur.lease_tenant_id, id],
      );
    }

    const updQ = await this.pool.query(
      `
      UPDATE lease_guarantees
      SET guarantor_full_name = COALESCE($2, guarantor_full_name),
          guarantor_email     = COALESCE($3, guarantor_email),
          guarantor_phone     = COALESCE($4, guarantor_phone),
          visale_reference    = COALESCE($5, visale_reference),
          selected            = COALESCE($6, selected),
          updated_at          = NOW()
      WHERE id=$1
      RETURNING *
      `,
      [id, guarantorFullName, guarantorEmail, guarantorPhone, visaleReference, selected],
    );

    return { ok: true, item: updQ.rows[0] };
  }

  async remove(id: string) {
    if (!id) throw new BadRequestException('Missing id');

    const curQ = await this.pool.query(`SELECT * FROM lease_guarantees WHERE id=$1`, [id]);
    if (!curQ.rowCount) throw new BadRequestException('Guarantee not found');
    const cur = curQ.rows[0];

    await this.pool.query(`DELETE FROM lease_guarantees WHERE id=$1`, [id]);

    // si on a supprimé la selected, auto-select la plus récente restante
    if (cur.selected) {
      const nextQ = await this.pool.query(
        `
        SELECT id FROM lease_guarantees
        WHERE lease_tenant_id=$1
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [cur.lease_tenant_id],
      );

      if (nextQ.rowCount) {
        const nextId = nextQ.rows[0].id;
        await this.pool.query(
          `UPDATE lease_guarantees
          SET selected=true, updated_at=NOW()
          WHERE id=$1`,
          [nextId],
        );
      }
    }

    return { ok: true };
  }

}