import { Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class TenantsService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  private normalizeEmail(email: any) {
    const s = String(email ?? '').trim();
    if (!s) return null;
    // very light validation
    if (!s.includes('@') || s.length < 5) throw new BadRequestException('Invalid email');
    return s.toLowerCase();
  }

  async create(body: any) {
    const fullName = String(body?.fullName ?? body?.full_name ?? '').trim();
    if (!fullName) throw new BadRequestException('Missing fullName');

    const email = this.normalizeEmail(body?.email);
    const phone = body?.phone ? String(body.phone).trim() : null;

    const birthDate = body?.birthDate || body?.birth_date || null; // expected YYYY-MM-DD
    const birthPlace = body?.birthPlace ? String(body.birthPlace).trim() : (body?.birth_place ? String(body.birth_place).trim() : null);
    const currentAddress = body?.currentAddress ? String(body.currentAddress).trim() : (body?.current_address ? String(body.current_address).trim() : null);

    const r = await this.pool.query(
      `INSERT INTO tenants (full_name, email, phone, birth_date, birth_place, current_address)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [fullName, email, phone, birthDate, birthPlace, currentAddress]
    );
    return r.rows[0];
  }

  async list() {
    const r = await this.pool.query(
      `SELECT * FROM tenants ORDER BY created_at DESC`
    );
    return r.rows;
  }

  async get(id: string) {
    const r = await this.pool.query(`SELECT * FROM tenants WHERE id=$1`, [id]);
    if (!r.rowCount) throw new BadRequestException('Unknown tenant');
    return r.rows[0];
  }

  async update(id: string, body: any) {
    // Allowed fields
    const patch: any = {};

    if (body?.fullName !== undefined || body?.full_name !== undefined) {
      const fullName = String(body?.fullName ?? body?.full_name ?? '').trim();
      if (!fullName) throw new BadRequestException('fullName cannot be empty');
      patch.full_name = fullName;
    }

    if (body?.email !== undefined) {
      patch.email = this.normalizeEmail(body.email);
    }

    if (body?.phone !== undefined) {
      patch.phone = body.phone ? String(body.phone).trim() : null;
    }

    if (body?.birthDate !== undefined || body?.birth_date !== undefined) {
      patch.birth_date = body?.birthDate ?? body?.birth_date ?? null;
    }

    if (body?.birthPlace !== undefined || body?.birth_place !== undefined) {
      patch.birth_place = body?.birthPlace ? String(body.birthPlace).trim() : (body?.birth_place ? String(body.birth_place).trim() : null);
    }

    if (body?.currentAddress !== undefined || body?.current_address !== undefined) {
      patch.current_address = body?.currentAddress ? String(body.currentAddress).trim() : (body?.current_address ? String(body.current_address).trim() : null);
    }

    const keys = Object.keys(patch);
    if (!keys.length) throw new BadRequestException('No valid fields');

    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    for (const k of keys) {
      sets.push(`${k}=$${i++}`);
      vals.push(patch[k]);
    }
    vals.push(id);

    const sql = `UPDATE tenants SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`;
    const r = await this.pool.query(sql, vals);
    if (!r.rowCount) throw new BadRequestException('Unknown tenant');
    return r.rows[0];
  }

  async remove(id: string) {
    // If tenant is referenced by leases, Postgres will block due to FK RESTRICT.
    try {
      const r = await this.pool.query(`DELETE FROM tenants WHERE id=$1 RETURNING id`, [id]);
      if (!r.rowCount) throw new BadRequestException('Unknown tenant');
      return { ok: true, id };
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.toLowerCase().includes('violates foreign key constraint')) {
        throw new BadRequestException('Cannot delete tenant: tenant is linked to a lease');
      }
      throw e;
    }
  }
}
