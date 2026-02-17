// leases.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';

type LeaseKind = 'MEUBLE_RP' | 'NU_RP' | 'SAISONNIER';

@Injectable()
export class LeasesService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  private normalizeKind(v: any): LeaseKind {
    const k = String(v || 'MEUBLE_RP').trim().toUpperCase();
    if (k === 'MEUBLE_RP' || k === 'NU_RP' || k === 'SAISONNIER') return k as LeaseKind;
    return 'MEUBLE_RP';
  }

  private async autoActivateDrafts() {
    const r = await this.pool.query(
      `UPDATE leases
       SET status='active'
       WHERE status='draft'
         AND start_date::date <= CURRENT_DATE`,
    );
    return r.rowCount || 0;
  }

  async createWithInit(payload: any) {
    const {
      unitId,
      tenantId,
      coTenantIds, // ✅ NEW
      startDate,
      endDateTheoretical,
      rentCents,
      chargesMode,
      chargesCents,
      depositCents,
      paymentDay,

      kind,
      guarantorFullName,
      guarantorEmail,
      guarantorPhone,
      guarantorAddress,

      // ✅ designation, IRL and keys
      leaseDesignation,
      keysCount,
      irlReferenceQuarter,
      irlReferenceValue,
    } = payload;

    const leaseKind = this.normalizeKind(kind);

    // ✅ normalize coTenantIds
    const coIdsRaw = Array.isArray(coTenantIds) ? coTenantIds : [];
    const coIds = Array.from(new Set(coIdsRaw.map((x) => String(x || '').trim()).filter(Boolean))).filter(
      (id) => id !== String(tenantId),
    );

    let leaseDesignationJson: any = null;
    if (leaseDesignation && typeof leaseDesignation === 'object') leaseDesignationJson = leaseDesignation;
    else if (typeof leaseDesignation === 'string' && leaseDesignation.trim()) {
      try {
        leaseDesignationJson = JSON.parse(leaseDesignation);
      } catch {
        leaseDesignationJson = { description: leaseDesignation };
      }
    }

    const keysCountInt = keysCount === null || keysCount === undefined || keysCount === '' ? null : Number(keysCount);

    const irlValueNum =
      irlReferenceValue === null || irlReferenceValue === undefined || irlReferenceValue === ''
        ? null
        : Number(irlReferenceValue);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const unit = await client.query('SELECT id FROM units WHERE id=$1', [unitId]);
      if (!unit.rowCount) throw new BadRequestException('Unknown unitId');

      const tenant = await client.query('SELECT id FROM tenants WHERE id=$1', [tenantId]);
      if (!tenant.rowCount) throw new BadRequestException('Unknown tenantId');

      // ✅ validate co-tenants existence (if any)
      if (coIds.length) {
        const rr = await client.query(`SELECT id FROM tenants WHERE id = ANY($1::uuid[])`, [coIds]);
        if ((rr.rowCount || 0) !== coIds.length) {
          throw new BadRequestException('One or more coTenantIds are unknown');
        }
      }

      const leaseRes = await client.query(
        `INSERT INTO leases (
           unit_id, tenant_id, start_date, end_date_theoretical,
           rent_cents, charges_cents, deposit_cents, payment_day,
           status, kind,
           guarantor_full_name, guarantor_email, guarantor_phone, guarantor_address,
           lease_designation,
           keys_count,
           irl_reference_quarter, irl_reference_value,
           charges_mode
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING *`,
        [
          unitId,
          tenantId,
          startDate,
          endDateTheoretical,
          rentCents,
          chargesCents ?? 0,
          depositCents ?? 0,
          paymentDay ?? 5,
          leaseKind,
          guarantorFullName ? String(guarantorFullName) : null,
          guarantorEmail ? String(guarantorEmail) : null,
          guarantorPhone ? String(guarantorPhone) : null,
          guarantorAddress ? String(guarantorAddress) : null,
          leaseDesignationJson ? JSON.stringify(leaseDesignationJson) : null,
          Number.isFinite(keysCountInt as any) ? keysCountInt : null,
          irlReferenceQuarter ? String(irlReferenceQuarter) : null,
          Number.isFinite(irlValueNum as any) ? irlValueNum : null,
          chargesMode ? String(chargesMode) : 'FORFAIT',
        ],
      );

      const lease = leaseRes.rows[0];

      // principal always
      await client.query(
        `INSERT INTO lease_tenants (lease_id, tenant_id, role)
         VALUES ($1,$2,'principal')
         ON CONFLICT (lease_id, tenant_id) DO NOTHING`,
        [lease.id, tenantId],
      );

      // ✅ cotenants at creation
      if (coIds.length) {
        await client.query(
          `INSERT INTO lease_tenants (lease_id, tenant_id, role)
           SELECT $1, x, 'cotenant'
           FROM unnest($2::uuid[]) AS x
           ON CONFLICT (lease_id, tenant_id) DO NOTHING`,
          [lease.id, coIds],
        );
      }

      // amounts line at startDate
      await client.query(
        `INSERT INTO lease_amounts (lease_id, effective_date, rent_cents, charges_cents, deposit_cents, payment_day)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (lease_id, effective_date) DO NOTHING`,
        [lease.id, startDate, rentCents, chargesCents ?? 0, depositCents ?? 0, paymentDay ?? 5],
      );

      // ✅ OPTION 2 (propre): NE PAS créer automatiquement EDL/Inventaire ici.
      await client.query('COMMIT');
      return { lease, edlSession: null, invSession: null };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // ✅ allow changing designation/keys/IRL after creation
  async updateDesignationAndIrl(leaseId: string, body: any) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const leaseDesignation = body?.leaseDesignation;
    const keysCount = body?.keysCount;
    const irlReferenceQuarter = body?.irlReferenceQuarter;
    const irlReferenceValue = body?.irlReferenceValue;

    let leaseDesignationJson: any = null;
    if (leaseDesignation && typeof leaseDesignation === 'object') leaseDesignationJson = leaseDesignation;
    else if (typeof leaseDesignation === 'string' && leaseDesignation.trim()) {
      try {
        leaseDesignationJson = JSON.parse(leaseDesignation);
      } catch {
        leaseDesignationJson = { description: leaseDesignation };
      }
    }

    const keysCountInt = keysCount === null || keysCount === undefined || keysCount === '' ? null : Number(keysCount);

    const irlValueNum =
      irlReferenceValue === null || irlReferenceValue === undefined || irlReferenceValue === ''
        ? null
        : Number(irlReferenceValue);

    const r = await this.pool.query(
      `UPDATE leases
       SET lease_designation = COALESCE($2::jsonb, lease_designation),
           keys_count = COALESCE($3::int, keys_count),
           irl_reference_quarter = COALESCE($4::text, irl_reference_quarter),
           irl_reference_value = COALESCE($5::numeric, irl_reference_value)
       WHERE id=$1
       RETURNING *`,
      [
        leaseId,
        leaseDesignationJson ? JSON.stringify(leaseDesignationJson) : null,
        Number.isFinite(keysCountInt as any) ? keysCountInt : null,
        irlReferenceQuarter ? String(irlReferenceQuarter) : null,
        Number.isFinite(irlValueNum as any) ? irlValueNum : null,
      ],
    );

    if (!r.rowCount) throw new BadRequestException('Unknown leaseId');
    return { ok: true, lease: r.rows[0] };
  }

  async activateLease(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const r = await this.pool.query(
      `UPDATE leases
       SET status='active'
       WHERE id=$1 AND status='draft'
       RETURNING *`,
      [leaseId],
    );

    if (!r.rowCount) throw new BadRequestException('Lease not found or not in draft');
    return { ok: true, lease: r.rows[0] };
  }

  async setNotice(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const r = await this.pool.query(
      `UPDATE leases
       SET status='notice'
       WHERE id=$1 AND status='active'
       RETURNING *`,
      [leaseId],
    );
    if (!r.rowCount) throw new BadRequestException('Lease not found or not active');
    return { ok: true, lease: r.rows[0] };
  }

  async cancelNotice(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const r = await this.pool.query(
      `UPDATE leases
       SET status='active'
       WHERE id=$1 AND status='notice'
       RETURNING *`,
      [leaseId],
    );
    if (!r.rowCount) throw new BadRequestException('Lease not found or not in notice');
    return { ok: true, lease: r.rows[0] };
  }

  async closeLease(leaseId: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const leaseRes = await client.query(`SELECT * FROM leases WHERE id=$1`, [leaseId]);
      if (!leaseRes.rowCount) throw new BadRequestException('Unknown leaseId');
      const lease = leaseRes.rows[0];

      if (lease.status === 'ended') throw new BadRequestException('Lease already ended');

      const edl = await client.query(
        `SELECT id FROM edl_sessions WHERE lease_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [leaseId],
      );
      const inv = await client.query(
        `SELECT id FROM inventory_sessions WHERE lease_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [leaseId],
      );

      const edlId = edl.rowCount ? edl.rows[0].id : null;
      const invId = inv.rowCount ? inv.rows[0].id : null;

      await client.query(`UPDATE leases SET status='ended' WHERE id=$1`, [leaseId]);

      if (edlId) {
        await client.query(`UPDATE edl_sessions SET status='exit_signed', exit_done_at=now() WHERE id=$1`, [edlId]);
      }

      if (invId) {
        await client.query(`UPDATE inventory_sessions SET status='exit_signed' WHERE id=$1`, [invId]);
      }

      await client.query(
        `INSERT INTO unit_reference_state (unit_id, reference_edl_session_id, reference_inventory_session_id, updated_at)
         VALUES ($1,$2,$3,now())
         ON CONFLICT (unit_id)
         DO UPDATE SET reference_edl_session_id=$2, reference_inventory_session_id=$3, updated_at=now()`,
        [lease.unit_id, edlId, invId],
      );

      await client.query('COMMIT');
      return { ok: true, leaseId, unitId: lease.unit_id, referenceEdl: edlId, referenceInventory: invId };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async addCoTenant(leaseId: string, body: any) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    const tenantId = String(body?.tenantId || '').trim();
    const role = String(body?.role || 'cotenant').trim();

    if (!tenantId) throw new BadRequestException('Missing tenantId');

    const leaseRes = await this.pool.query(`SELECT id FROM leases WHERE id=$1`, [leaseId]);
    if (!leaseRes.rowCount) throw new BadRequestException('Unknown leaseId');

    const t = await this.pool.query(`SELECT id FROM tenants WHERE id=$1`, [tenantId]);
    if (!t.rowCount) throw new BadRequestException('Unknown tenantId');

    await this.pool.query(
      `INSERT INTO lease_tenants (lease_id, tenant_id, role)
       VALUES ($1,$2,$3)
       ON CONFLICT (lease_id, tenant_id) DO NOTHING`,
      [leaseId, tenantId, role],
    );

    return { ok: true };
  }

  async removeCoTenant(leaseId: string, tenantId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    if (!tenantId) throw new BadRequestException('Missing tenantId');

    const leaseRes = await this.pool.query(`SELECT tenant_id FROM leases WHERE id=$1`, [leaseId]);
    if (!leaseRes.rowCount) throw new BadRequestException('Unknown leaseId');
    const principal = leaseRes.rows[0].tenant_id;

    if (principal === tenantId) {
      throw new BadRequestException('Cannot remove principal tenant from lease');
    }

    const r = await this.pool.query(`DELETE FROM lease_tenants WHERE lease_id=$1 AND tenant_id=$2`, [leaseId, tenantId]);

    return { ok: true, removed: r.rowCount };
  }

  async addAmounts(leaseId: string, body: any) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const effectiveDate = String(body?.effectiveDate || '').slice(0, 10);
    if (!effectiveDate) throw new BadRequestException('Missing effectiveDate (YYYY-MM-DD)');

    const rentCents = Number(body?.rentCents);
    const chargesCents = Number(body?.chargesCents ?? 0);
    const depositCents = Number(body?.depositCents ?? 0);
    const paymentDay = Number(body?.paymentDay ?? 5);

    if (Number.isNaN(rentCents)) throw new BadRequestException('rentCents must be a number');
    if (Number.isNaN(chargesCents)) throw new BadRequestException('chargesCents must be a number');
    if (Number.isNaN(depositCents)) throw new BadRequestException('depositCents must be a number');
    if (Number.isNaN(paymentDay)) throw new BadRequestException('paymentDay must be a number');

    const leaseRes = await this.pool.query(`SELECT id FROM leases WHERE id=$1`, [leaseId]);
    if (!leaseRes.rowCount) throw new BadRequestException('Unknown leaseId');

    await this.pool.query(
      `INSERT INTO lease_amounts (lease_id, effective_date, rent_cents, charges_cents, deposit_cents, payment_day)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (lease_id, effective_date)
       DO UPDATE SET rent_cents=$3, charges_cents=$4, deposit_cents=$5, payment_day=$6`,
      [leaseId, effectiveDate, rentCents, chargesCents, depositCents, paymentDay],
    );

    return { ok: true };
  }

  async getDetails(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const leaseR = await this.pool.query(
      `SELECT l.*, u.code as unit_code, t.full_name as tenant_name
       FROM leases l
       JOIN units u ON u.id = l.unit_id
       JOIN tenants t ON t.id = l.tenant_id
       WHERE l.id=$1`,
      [leaseId],
    );
    if (!leaseR.rowCount) throw new BadRequestException('Unknown leaseId');

    const tenantsR = await this.pool.query(
      `SELECT lt.role, t.*
       FROM lease_tenants lt
       JOIN tenants t ON t.id = lt.tenant_id
       WHERE lt.lease_id=$1
       ORDER BY CASE WHEN lt.role='principal' THEN 0 ELSE 1 END, t.full_name`,
      [leaseId],
    );

    const amountsR = await this.pool.query(
      `SELECT *
       FROM lease_amounts
       WHERE lease_id=$1
       ORDER BY effective_date DESC`,
      [leaseId],
    );

    return {
      lease: leaseR.rows[0],
      tenants: tenantsR.rows,
      amounts: amountsR.rows,
    };
  }

  async list() {
    await this.autoActivateDrafts();

    const r = await this.pool.query(
      `SELECT
         l.*,
         u.code as unit_code,
         t.full_name as tenant_name,
         COALESCE(a.rent_cents, l.rent_cents) as rent_cents,
         COALESCE(a.charges_cents, l.charges_cents) as charges_cents,
         COALESCE(a.deposit_cents, l.deposit_cents) as deposit_cents,
         COALESCE(a.payment_day, l.payment_day) as payment_day
       FROM leases l
       JOIN units u ON u.id = l.unit_id
       JOIN tenants t ON t.id = l.tenant_id
       LEFT JOIN LATERAL (
         SELECT rent_cents, charges_cents, deposit_cents, payment_day
         FROM lease_amounts
         WHERE lease_id=l.id AND effective_date <= CURRENT_DATE
         ORDER BY effective_date DESC
         LIMIT 1
       ) a ON TRUE
       ORDER BY l.created_at DESC`,
    );

    return r.rows;
  }
}
