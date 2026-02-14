import { BadRequestException, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class BuildingsService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  async list(projectId?: string) {
    if (projectId) {
      const r = await this.pool.query(
        `SELECT b.*, p.name as project_name
         FROM buildings b
         JOIN projects p ON p.id=b.project_id
         WHERE b.project_id=$1
         ORDER BY b.created_at DESC`,
        [projectId]
      );
      return r.rows;
    }

    const r = await this.pool.query(
      `SELECT b.*, p.name as project_name
       FROM buildings b
       JOIN projects p ON p.id=b.project_id
       ORDER BY b.created_at DESC`
    );
    return r.rows;
  }

  async create(body: any) {
    const projectId = String(body?.projectId || '').trim();
    const name = String(body?.name || '').trim();
    const address = String(body?.address || '').trim();
    const notes = body?.notes ? String(body.notes) : null;

    if (!projectId) throw new BadRequestException('Missing projectId');
    if (!name) throw new BadRequestException('Missing name');
    if (!address) throw new BadRequestException('Missing address');

    // check project exists
    const p = await this.pool.query(`SELECT id FROM projects WHERE id=$1`, [projectId]);
    if (!p.rowCount) throw new BadRequestException('Unknown projectId');

    const r = await this.pool.query(
      `INSERT INTO buildings (project_id, name, address, notes)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [projectId, name, address, notes]
    );
    return r.rows[0];
  }
}
