import { BadRequestException, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class ProjectsService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  async listProjects() {
    const r = await this.pool.query(
      `SELECT * FROM projects ORDER BY created_at DESC`
    );
    return r.rows;
  }

  async createProject(body: any) {
    const name = String(body?.name || '').trim();
    const kind = String(body?.kind || 'indivision').trim();
    const notes = body?.notes ? String(body.notes) : null;

    if (!name) throw new BadRequestException('Project name is required');

    const r = await this.pool.query(
      `INSERT INTO projects (name, kind, notes)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [name, kind, notes]
    );
    return r.rows[0];
  }

  async listMembers(projectId: string) {
    if (!projectId) throw new BadRequestException('Missing projectId');
    const r = await this.pool.query(
      `SELECT * FROM project_members
       WHERE project_id=$1
       ORDER BY created_at ASC`,
      [projectId]
    );
    return r.rows;
  }

  async addMember(projectId: string, body: any) {
    if (!projectId) throw new BadRequestException('Missing projectId');
    const fullName = String(body?.fullName || '').trim();
    const role = String(body?.role || 'indivisaire').trim();
    const sharePct = body?.sharePct ?? null;
    const email = body?.email ? String(body.email).trim() : null;
    const phone = body?.phone ? String(body.phone).trim() : null;

    if (!fullName) throw new BadRequestException('Member fullName is required');

    const r = await this.pool.query(
      `INSERT INTO project_members (project_id, full_name, role, share_pct, email, phone)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [projectId, fullName, role, sharePct, email, phone]
    );
    return r.rows[0];
  }
}
