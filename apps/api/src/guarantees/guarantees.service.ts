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

  private assertCautionHasContact(input: any) {
    const type = String(input?.type || '').toUpperCase();
    if (type !== 'CAUTION') return;

    const name = String(
      input?.guarantorFullName ?? input?.guarantor_full_name ?? '',
    ).trim();

    const email = String(
      input?.guarantorEmail ?? input?.guarantor_email ?? '',
    ).trim();

    const address = String(
      input?.guarantorAddress ?? input?.guarantor_address ?? '',
    ).trim();

    if (!name) {
      throw new BadRequestException('CAUTION requires guarantor_full_name');
    }
    if (!email || !email.includes('@')) {
      throw new BadRequestException('CAUTION requires valid guarantor_email');
    }
    if (!address) {
      throw new BadRequestException('CAUTION requires guarantor_address');
    }
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

  private async getLeaseTenantByLeaseAndTenantOrThrow(leaseId: string, tenantId: string) {
    const leaseIdTrim = String(leaseId || '').trim();
    const tenantIdTrim = String(tenantId || '').trim();

    if (!leaseIdTrim || !tenantIdTrim) {
      throw new BadRequestException('leaseId and tenantId are required');
    }

    const q = await this.pool.query(
      `SELECT id, lease_id, tenant_id, role
       FROM lease_tenants
       WHERE lease_id = $1 AND tenant_id = $2
       LIMIT 1`,
      [leaseIdTrim, tenantIdTrim],
    );

    const row = q.rows?.[0];
    if (!row) {
      throw new NotFoundException(`Lease tenant not found for leaseId=${leaseIdTrim} tenantId=${tenantIdTrim}`);
    }
    return row;
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
    // ✅ accepte soit leaseTenantId, soit (leaseId + tenantId)
    const leaseTenantIdFromBody = String(body?.leaseTenantId || '').trim();

    const leaseTenant = leaseTenantIdFromBody
      ? await this.getLeaseTenantOrThrow(leaseTenantIdFromBody)
      : await this.getLeaseTenantByLeaseAndTenantOrThrow(body?.leaseId, body?.tenantId);

    const leaseTenantId = String(leaseTenant?.id || '').trim();
    if (!leaseTenantId) throw new BadRequestException('Invalid leaseTenant');

    const type = this.normalizeType(body?.type);

    // ✅ CAUTION: require contact fields
    this.assertCautionHasContact({ ...body, type });

    const status = body?.status
      ? this.normalizeStatus(body.status)
      : ('DRAFT' as GuaranteeStatus);

    const selected = body?.selected === true;
    const rank = body?.rank ?? null;

    // fields (accept camelCase + snake_case)
    const guarantorFullName =
      body?.guarantorFullName ?? body?.guarantor_full_name ?? null;
    const guarantorEmail =
      body?.guarantorEmail ?? body?.guarantor_email ?? null;
    const guarantorPhone =
      body?.guarantorPhone ?? body?.guarantor_phone ?? null;
    const guarantorAddress =
      body?.guarantorAddress ?? body?.guarantor_address ?? null;
    const visaleReference =
      body?.visaleReference ?? body?.visale_reference ?? null;
    const visaleValidatedAt =
      body?.visaleValidatedAt ?? body?.visale_validated_at ?? null;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // ✅ if selected=true, deselect others for this lease_tenant
      if (selected) {
        await client.query(
          `UPDATE lease_guarantees
          SET selected=false, updated_at=NOW()
          WHERE lease_tenant_id=$1 AND selected=true`,
          [leaseTenantId],
        );
      }

      const ins = await client.query(
        `
        INSERT INTO lease_guarantees
          (lease_tenant_id, lease_id, type, status, selected, rank,
          guarantor_full_name, guarantor_email, guarantor_phone, guarantor_address,
          visale_reference, visale_validated_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *
        `,
        [
          leaseTenantId,
          leaseTenant.lease_id,
          type,
          status,
          selected,
          rank,
          guarantorFullName,
          guarantorEmail,
          guarantorPhone,
          guarantorAddress,
          visaleReference,
          visaleValidatedAt,
        ],
      );

      await client.query('COMMIT');
      return { ok: true, item: ins.rows[0] };
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

  // ✅ select = true (and deselect others)
  async select(id: string) {
    if (!id) throw new BadRequestException('Missing id');

    const existing = await this.pool.query(`SELECT * FROM lease_guarantees WHERE id=$1`, [id]);
    if (!existing.rowCount) throw new NotFoundException('Guarantee not found');

    const row = existing.rows[0];
    // ✅ If selecting a CAUTION, ensure mandatory contact fields exist
    this.assertCautionHasContact(row);
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
    // ✅ Validate CAUTION fields against final merged state (patch-safe)
    const merged = {
      ...cur,
      guarantor_full_name:
        body?.guarantorFullName ?? body?.guarantor_full_name ?? cur.guarantor_full_name,
      guarantor_email:
        body?.guarantorEmail ?? body?.guarantor_email ?? cur.guarantor_email,
      guarantor_address:
        body?.guarantorAddress ?? body?.guarantor_address ?? cur.guarantor_address,
      // type comes from DB (source of truth)
      type: cur.type,
    };
    this.assertCautionHasContact(merged);

    // champs modifiables
    const guarantorFullName = body?.guarantorFullName ?? body?.guarantor_full_name ?? null;
    const guarantorEmail = body?.guarantorEmail ?? body?.guarantor_email ?? null;
    const guarantorPhone = body?.guarantorPhone ?? body?.guarantor_phone ?? null;
    const guarantorAddress = body?.guarantorAddress ?? body?.guarantor_address ?? null;
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
          guarantor_address   = COALESCE($5, guarantor_address),
          visale_reference    = COALESCE($6, visale_reference),
          selected            = COALESCE($7, selected),
          updated_at          = NOW()
      WHERE id=$1
      RETURNING *
      `,
      [id, guarantorFullName, guarantorEmail, guarantorPhone, guarantorAddress, visaleReference, selected]
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