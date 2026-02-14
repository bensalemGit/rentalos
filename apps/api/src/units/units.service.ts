import { BadRequestException, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class UnitsService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  private normalizeText(v: any, fallback: string) {
    const s = String(v ?? '').trim();
    return s ? s : fallback;
  }

  private normalizeNumber(v: any, fallback: number) {
    if (v === '' || v === null || v === undefined) return fallback;
    const n = Number(v);
    if (Number.isNaN(n)) throw new BadRequestException('Numeric field must be a number');
    return n;
  }

  async create(data: any) {
    const code = this.normalizeText(data?.code, '');
    const label = this.normalizeText(data?.label, '');
    if (!code) throw new BadRequestException('Missing code');
    if (!label) throw new BadRequestException('Missing label');

    const addressLine1 = this.normalizeText(data?.addressLine1, '—');
    const city = this.normalizeText(data?.city, '—');
    const postalCode = this.normalizeText(data?.postalCode, '—');

    const surfaceM2 = this.normalizeNumber(data?.surfaceM2, 0);
    const floor = this.normalizeNumber(data?.floor, 0);

    const projectId = data?.projectId ? String(data.projectId) : null;
    const buildingId = data?.buildingId ? String(data.buildingId) : null;

    // Validate project if provided
    if (projectId) {
      const p = await this.pool.query(`SELECT id FROM projects WHERE id=$1`, [projectId]);
      if (!p.rowCount) throw new BadRequestException('Unknown projectId');
    }

    // Validate building if provided + ensure belongs to project (if project provided)
    if (buildingId) {
      const b = await this.pool.query(`SELECT id, project_id FROM buildings WHERE id=$1`, [buildingId]);
      if (!b.rowCount) throw new BadRequestException('Unknown buildingId');
      if (projectId && b.rows[0].project_id !== projectId) {
        throw new BadRequestException('buildingId does not belong to projectId');
      }
    }

    try {
      const r = await this.pool.query(
        `INSERT INTO units (code, label, address_line1, city, postal_code, surface_m2, floor, project_id, building_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [code, label, addressLine1, city, postalCode, surfaceM2, floor, projectId, buildingId]
      );
      return r.rows[0];
    } catch (e: any) {
      if (e?.code === '23505') {
        if (String(e?.constraint || '').includes('units_code_key')) {
          throw new BadRequestException(
            `Ce code logement existe déjà : "${code}". Choisissez un code unique (ex: SOU1-A01).`
          );
        }
        throw new BadRequestException('Contrainte unique violée (valeur déjà existante).');
      }
      throw e;
    }
  }

  async update(id: string, patch: any) {
    if (!id) throw new BadRequestException('Missing unit id');

    const current = await this.pool.query(`SELECT * FROM units WHERE id=$1`, [id]);
    if (!current.rowCount) throw new BadRequestException('Unknown unit');

    const existing = current.rows[0];

    // Build updated values (partial update)
    const nextCode = patch?.code !== undefined ? this.normalizeText(patch.code, '') : existing.code;
    const nextLabel = patch?.label !== undefined ? this.normalizeText(patch.label, '') : existing.label;

    if (!nextCode) throw new BadRequestException('Missing code');
    if (!nextLabel) throw new BadRequestException('Missing label');

    const nextAddress =
      patch?.addressLine1 !== undefined ? this.normalizeText(patch.addressLine1, '—') : existing.address_line1;
    const nextCity = patch?.city !== undefined ? this.normalizeText(patch.city, '—') : existing.city;
    const nextPostal =
      patch?.postalCode !== undefined ? this.normalizeText(patch.postalCode, '—') : existing.postal_code;

    const nextSurface =
      patch?.surfaceM2 !== undefined ? this.normalizeNumber(patch.surfaceM2, 0) : Number(existing.surface_m2 ?? 0);
    const nextFloor =
      patch?.floor !== undefined ? this.normalizeNumber(patch.floor, 0) : Number(existing.floor ?? 0);

    const nextProjectId =
      patch?.projectId !== undefined ? (patch.projectId ? String(patch.projectId) : null) : existing.project_id;
    const nextBuildingId =
      patch?.buildingId !== undefined ? (patch.buildingId ? String(patch.buildingId) : null) : existing.building_id;

    // Validate project if provided
    if (nextProjectId) {
      const p = await this.pool.query(`SELECT id FROM projects WHERE id=$1`, [nextProjectId]);
      if (!p.rowCount) throw new BadRequestException('Unknown projectId');
    }

    // Validate building if provided + ensure belongs to project (if project provided)
    if (nextBuildingId) {
      const b = await this.pool.query(`SELECT id, project_id FROM buildings WHERE id=$1`, [nextBuildingId]);
      if (!b.rowCount) throw new BadRequestException('Unknown buildingId');
      if (nextProjectId && b.rows[0].project_id !== nextProjectId) {
        throw new BadRequestException('buildingId does not belong to projectId');
      }
    }

    try {
      const r = await this.pool.query(
        `UPDATE units
         SET code=$2, label=$3, address_line1=$4, city=$5, postal_code=$6, surface_m2=$7, floor=$8, project_id=$9, building_id=$10
         WHERE id=$1
         RETURNING *`,
        [id, nextCode, nextLabel, nextAddress, nextCity, nextPostal, nextSurface, nextFloor, nextProjectId, nextBuildingId]
      );
      return r.rows[0];
    } catch (e: any) {
      if (e?.code === '23505') {
        if (String(e?.constraint || '').includes('units_code_key')) {
          throw new BadRequestException(
            `Ce code logement existe déjà : "${nextCode}". Choisissez un code unique (ex: SOU1-A01).`
          );
        }
        throw new BadRequestException('Contrainte unique violée (valeur déjà existante).');
      }
      throw e;
    }
  }

  async list() {
    const r = await this.pool.query(`
      SELECT
        u.*,
        p.name as project_name,
        b.name as building_name
      FROM units u
      LEFT JOIN projects p ON p.id = u.project_id
      LEFT JOIN buildings b ON b.id = u.building_id
      ORDER BY u.created_at DESC
    `);
    return r.rows;
  }

  // ============================================================
  // ✅ NEW: Save reference model for a unit from a specific lease
  // ============================================================
  async saveReferenceFromLease(unitId: string, leaseId: string) {
    const uId = String(unitId || '').trim();
    const lId = String(leaseId || '').trim();
    if (!uId) throw new BadRequestException('Missing unitId');
    if (!lId) throw new BadRequestException('Missing leaseId');

    // 1) Ensure unit exists
    const unit = await this.pool.query(`SELECT id FROM units WHERE id=$1`, [uId]);
    if (!unit.rowCount) throw new BadRequestException('Unknown unitId');

    // 2) Ensure lease exists and belongs to unit
    const lease = await this.pool.query(`SELECT id, unit_id FROM leases WHERE id=$1`, [lId]);
    if (!lease.rowCount) throw new BadRequestException('Unknown leaseId');
    if (String(lease.rows[0].unit_id) !== uId) {
      throw new BadRequestException('leaseId does not belong to unitId');
    }

    // 3) Take latest EDL session + latest Inventory session of this lease
    const edl = await this.pool.query(
      `SELECT id
       FROM edl_sessions
       WHERE lease_id=$1
       ORDER BY created_at DESC
       LIMIT 1`,
      [lId],
    );

    const inv = await this.pool.query(
      `SELECT id
       FROM inventory_sessions
       WHERE lease_id=$1
       ORDER BY created_at DESC
       LIMIT 1`,
      [lId],
    );

    const edlId = edl.rowCount ? edl.rows[0].id : null;
    const invId = inv.rowCount ? inv.rows[0].id : null;

    if (!edlId && !invId) {
      throw new BadRequestException('No EDL/Inventory sessions found for this lease');
    }

    // 4) Upsert into unit_reference_state
    await this.pool.query(
      `INSERT INTO unit_reference_state (unit_id, reference_edl_session_id, reference_inventory_session_id, updated_at)
       VALUES ($1,$2,$3,now())
       ON CONFLICT (unit_id)
       DO UPDATE SET reference_edl_session_id=$2, reference_inventory_session_id=$3, updated_at=now()`,
      [uId, edlId, invId],
    );

    return {
      ok: true,
      unitId: uId,
      leaseId: lId,
      referenceEdlSessionId: edlId,
      referenceInventorySessionId: invId,
    };
  }
}
