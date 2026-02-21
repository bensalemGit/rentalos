import { Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { Inject } from '@nestjs/common';
import { UpsertLandlordDto } from './landlord.dto';

@Injectable()
export class LandlordService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  async getByProject(projectId: string) {
    const q = await this.pool.query(
      `
      SELECT pl.*
      FROM projects p
      LEFT JOIN project_landlords pl ON pl.id = p.landlord_id
      WHERE p.id = $1
      `,
      [projectId],
    );

    if (!q.rowCount) {
      throw new NotFoundException('Project not found');
    }

    return q.rows[0] || null;
  }

  async upsertForProject(projectId: string, dto: UpsertLandlordDto) {
    // Ensure project exists
    const proj = await this.pool.query(`SELECT id, landlord_id FROM projects WHERE id=$1`, [projectId]);
    if (!proj.rowCount) throw new NotFoundException('Project not found');

    const existingLandlordId = proj.rows[0].landlord_id as string | null;

    if (existingLandlordId) {
      const upd = await this.pool.query(
        `
        UPDATE project_landlords
        SET name=$2, address=$3, email=$4, phone=$5, city=$6, postal_code=$7, updated_at=now()
        WHERE id=$1
        RETURNING *
        `,
        [
          existingLandlordId,
          dto.name,
          dto.address,
          dto.email,
          dto.phone,
          dto.city ?? null,
          dto.postal_code ?? null,
        ],
      );
      return upd.rows[0];
    }

    const ins = await this.pool.query(
      `
      INSERT INTO project_landlords (name, address, email, phone, city, postal_code)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id
      `,
      [dto.name, dto.address, dto.email, dto.phone, dto.city ?? null, dto.postal_code ?? null],
    );

    const landlordId = ins.rows[0].id;

    await this.pool.query(
      `UPDATE projects SET landlord_id=$2 WHERE id=$1`,
      [projectId, landlordId],
    );

    const loaded = await this.pool.query(`SELECT * FROM project_landlords WHERE id=$1`, [landlordId]);
    return loaded.rows[0];
  }
}