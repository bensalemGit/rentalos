import { BadRequestException, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

type PatchEdlItem = {
  section?: string;
  label?: string;
  entry_condition?: string | null;
  entry_notes?: string | null;
  exit_condition?: string | null;
  exit_notes?: string | null;
};

@Injectable()
export class EdlService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // stockage local des photos (MVP)
  private uploadRoot = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

  async listSessions(leaseId?: string) {
    if (leaseId) {
      const r = await this.pool.query(
        `SELECT * FROM edl_sessions WHERE lease_id=$1 ORDER BY created_at DESC`,
        [leaseId],
      );
      return r.rows;
    }
    const r = await this.pool.query(`SELECT * FROM edl_sessions ORDER BY created_at DESC`);
    return r.rows;
  }

  async createSession(leaseId: string, status?: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const normalized = String(status || 'entry').trim().toLowerCase();
    const finalStatus = normalized === 'draft' ? 'entry' : normalized;

    if (!['entry', 'exit'].includes(finalStatus)) {
      throw new BadRequestException(`Invalid EDL status (expected entry|exit)`);
    }

    // NB: unit_id NOT NULL est rempli via trigger
    const r = await this.pool.query(
      `INSERT INTO edl_sessions (lease_id, status)
       VALUES ($1,$2)
       RETURNING *`,
      [leaseId, finalStatus],
    );

    return r.rows[0];
  }

  async listItems(edlSessionId: string) {
    if (!edlSessionId) throw new BadRequestException('Missing edlSessionId');

    const r = await this.pool.query(
      `SELECT *
       FROM edl_items
       WHERE edl_session_id=$1
       ORDER BY section, label`,
      [edlSessionId],
    );
    return r.rows;
  }

  async updateItem(id: string, patch: PatchEdlItem) {
    if (!id) throw new BadRequestException('Missing id');

    const allowed = new Set([
      'section',
      'label',
      'entry_condition',
      'entry_notes',
      'exit_condition',
      'exit_notes',
    ]);

    const keys = Object.keys(patch || {}).filter((k) => allowed.has(k));
    if (!keys.length) throw new BadRequestException('No valid fields');

    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;

    for (const k of keys) {
      sets.push(`${k}=$${i++}`);
      vals.push((patch as any)[k]);
    }
    vals.push(id);

    const sql = `UPDATE edl_items SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`;
    const r = await this.pool.query(sql, vals);
    if (!r.rowCount) throw new BadRequestException('Unknown edl item');
    return r.rows[0];
  }

  // ------------------------------------------------------------
  // Ajout/Suppression d'items dans une session (sans template)
  // ------------------------------------------------------------
  async addItemToSession(edlSessionId: string, section: string, label: string) {
    if (!edlSessionId) throw new BadRequestException('Missing edlSessionId');
    const sec = String(section || 'Divers').trim() || 'Divers';
    const lab = String(label || '').trim();
    if (!lab) throw new BadRequestException('Missing label');

    // duplicate prevention (soft-block)
    const exists = await this.pool.query(
      `SELECT id FROM edl_items WHERE edl_session_id=$1 AND section=$2 AND label=$3 LIMIT 1`,
      [edlSessionId, sec, lab],
    );
    if (exists.rowCount) {
      throw new BadRequestException(
        `Item déjà présent dans cette section (section="${sec}", label="${lab}")`,
      );
    }

    const id = crypto.randomUUID();
    const r = await this.pool.query(
      `INSERT INTO edl_items (
         id, edl_session_id, section, label,
         entry_condition, entry_notes,
         exit_condition, exit_notes
       )
       VALUES ($1,$2,$3,$4,NULL,NULL,NULL,NULL)
       RETURNING *`,
      [id, edlSessionId, sec, lab],
    );
    return r.rows[0];
  }

  async removeItemFromSession(edlItemId: string) {
    if (!edlItemId) throw new BadRequestException('Missing edlItemId');

    // delete photos rows first (if FK exists)
    try {
      await this.pool.query(`DELETE FROM edl_photos WHERE edl_item_id=$1`, [edlItemId]);
    } catch {
      // ignore if table/constraint differs
    }

    const r = await this.pool.query(`DELETE FROM edl_items WHERE id=$1 RETURNING id`, [edlItemId]);
    if (!r.rowCount) throw new BadRequestException('Unknown edl item');
    return { ok: true, id: edlItemId };
  }

  // Safe copy entry -> exit inside latest session of a lease
  async copyEntryToExit(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const sQ = await this.pool.query(
      `SELECT id FROM edl_sessions WHERE lease_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [leaseId],
    );
    if (!sQ.rowCount) throw new BadRequestException('No EDL session for this lease');

    const edlSessionId = sQ.rows[0].id;

    const r = await this.pool.query(
      `UPDATE edl_items
       SET
         exit_condition = COALESCE(entry_condition, exit_condition),
         exit_notes = COALESCE(entry_notes, exit_notes)
       WHERE edl_session_id=$1`,
      [edlSessionId],
    );

    return { ok: true, edlSessionId, updatedCount: r.rowCount };
  }

  // ------------------------------------------------------------
  // Référence logement (unit_reference_state.reference_edl_session_id)
  // ------------------------------------------------------------
  async setEdlReferenceFromLease(leaseId: string, edlSessionId?: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const u = await this.pool.query(`SELECT unit_id FROM leases WHERE id=$1`, [leaseId]);
    if (!u.rowCount) throw new BadRequestException(`Unknown leaseId: ${leaseId}`);
    const unitId = u.rows[0].unit_id;

    let sid = edlSessionId;
    if (!sid) {
      const sQ = await this.pool.query(
        `SELECT id FROM edl_sessions WHERE lease_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [leaseId],
      );
      if (!sQ.rowCount) throw new BadRequestException('No EDL session for this lease');
      sid = sQ.rows[0].id;
    }

    await this.pool.query(
      `INSERT INTO unit_reference_state (unit_id, reference_edl_session_id)
       VALUES ($1,$2)
       ON CONFLICT (unit_id)
       DO UPDATE SET reference_edl_session_id = EXCLUDED.reference_edl_session_id`,
      [unitId, sid],
    );

    return { ok: true, unitId, referenceEdlSessionId: sid };
  }

  // ------------------------------------------------------------
  // Apply reference → lease (création nouvelle session clonée)
  // ------------------------------------------------------------
  async applyEdlReferenceToLease(leaseId: string, status: string = 'entry') {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const normalized = String(status || 'entry').trim().toLowerCase();
    const finalStatus = normalized === 'draft' ? 'entry' : normalized;
    if (!['entry', 'exit'].includes(finalStatus)) {
      throw new BadRequestException(`Invalid status (expected entry|exit)`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const u = await client.query(`SELECT unit_id FROM leases WHERE id=$1`, [leaseId]);
      if (!u.rowCount) throw new BadRequestException(`Unknown leaseId: ${leaseId}`);
      const unitId = u.rows[0].unit_id;

      const refQ = await client.query(
        `SELECT reference_edl_session_id
         FROM unit_reference_state
         WHERE unit_id=$1`,
        [unitId],
      );
      const refId = refQ.rows?.[0]?.reference_edl_session_id;
      if (!refId) throw new BadRequestException(`No EDL reference for unit ${unitId}`);

      const newSessionId = crypto.randomUUID();
      const sIns = await client.query(
        `INSERT INTO edl_sessions (id, lease_id, status)
         VALUES ($1,$2,$3)
         RETURNING *`,
        [newSessionId, leaseId, finalStatus],
      );

      const itemsQ = await client.query(
        `SELECT section, label, entry_condition, entry_notes
         FROM edl_items
         WHERE edl_session_id=$1
         ORDER BY section, label`,
        [refId],
      );

      for (const it of itemsQ.rows) {
        await client.query(
          `INSERT INTO edl_items (
             id, edl_session_id, section, label,
             entry_condition, entry_notes,
             exit_condition, exit_notes
           )
           VALUES ($1,$2,$3,$4,$5,$6,NULL,NULL)`,
          [
            crypto.randomUUID(),
            newSessionId,
            it.section,
            it.label,
            it.entry_condition,
            it.entry_notes,
          ],
        );
      }

      await client.query('COMMIT');
      return {
        ok: true,
        leaseId,
        unitId,
        referenceEdlSessionId: refId,
        edlSessionId: sIns.rows[0].id,
        status: finalStatus,
        createdItems: itemsQ.rowCount,
      };
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw e;
    } finally {
      client.release();
    }
  }

  // ------------------------------------------------------------
  // Photos (edl_photos)
  // ------------------------------------------------------------
  async listPhotos(edlItemId: string) {
    if (!edlItemId) throw new BadRequestException('Missing edlItemId');

    const r = await this.pool.query(
      `SELECT id, edl_item_id, filename, created_at
       FROM edl_photos
       WHERE edl_item_id=$1
       ORDER BY created_at DESC`,
      [edlItemId],
    );
    return r.rows;
  }

  private async ensureDir(dir: string) {
    await fsp.mkdir(dir, { recursive: true });
  }

  async uploadPhoto(file: any, body: any) {
    const edlItemId = body?.edlItemId || body?.edl_item_id;
    const leaseId = body?.leaseId || body?.lease_id;

    if (!edlItemId) throw new BadRequestException('Missing edlItemId');
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    if (!file) throw new BadRequestException('Missing file');

    let buf: Buffer;

    if (file.buffer && Buffer.isBuffer(file.buffer)) {
      buf = file.buffer;
    } else if (file.path) {
      buf = await fsp.readFile(file.path);
      // cleanup best-effort si multer a écrit un tmp
      try {
        await fsp.unlink(file.path);
      } catch {}
    } else {
      throw new BadRequestException('Unsupported upload (no buffer/path)');
    }

    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

    const extGuess =
      (typeof file.originalname === 'string' && path.extname(file.originalname)) || '';
    const mime = String(file.mimetype || 'application/octet-stream');

    const id = crypto.randomUUID();
    const safeName = String(file.originalname || `photo${extGuess || '.bin'}`)
      .replace(/[^\w.\-() ]+/g, '_')
      .slice(0, 120);

    const dir = path.join(this.uploadRoot, 'edl', String(leaseId));
    await this.ensureDir(dir);

    const storageFilename = `${id}${extGuess || ''}`;
    const absPath = path.join(dir, storageFilename);

    await fsp.writeFile(absPath, buf);

    await this.pool.query(
      `INSERT INTO edl_photos (id, edl_item_id, lease_id, filename, storage_path, mime_type, sha256)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, edlItemId, leaseId, safeName, absPath, mime, sha256],
    );

    return { ok: true, id, edlItemId, leaseId, filename: safeName };
  }

  async getPhotoFile(id: string) {
    if (!id) throw new BadRequestException('Missing id');

    const r = await this.pool.query(
      `SELECT id, filename, storage_path
       FROM edl_photos
       WHERE id=$1`,
      [id],
    );
    if (!r.rowCount) throw new BadRequestException('Unknown photo');

    const row = r.rows[0];
    const absPath = String(row.storage_path || '');
    const filename = String(row.filename || 'photo');

    if (!absPath) throw new BadRequestException('Photo storage_path missing');
    if (!fs.existsSync(absPath)) throw new BadRequestException('Photo file missing on disk');

    return { absPath, filename };
  }

  // ------------------------------------------------------------
  // GET Référence logement EDL (par leaseId) + preview
  // ------------------------------------------------------------
  async getEdlReferenceForLease(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    // 1) unit_id du bail
    const u = await this.pool.query(`SELECT unit_id FROM leases WHERE id=$1`, [leaseId]);
    if (!u.rowCount) throw new BadRequestException(`Unknown leaseId: ${leaseId}`);
    const unitId = u.rows[0].unit_id;

    // 2) reference session id
    const refQ = await this.pool.query(
      `SELECT reference_edl_session_id, updated_at
       FROM unit_reference_state
       WHERE unit_id=$1`,
      [unitId],
    );

    const referenceEdlSessionId = refQ.rows?.[0]?.reference_edl_session_id || null;
    const updatedAt = refQ.rows?.[0]?.updated_at || null;

    if (!referenceEdlSessionId) {
      return {
        ok: true,
        leaseId,
        unitId,
        updatedAt,
        referenceEdlSessionId: null,
        session: null,
        stats: { items: 0, sections: 0 },
        preview: [],
      };
    }

    // 3) session meta
    const sQ = await this.pool.query(
      `SELECT id, status, created_at, lease_id, unit_id
       FROM edl_sessions
       WHERE id=$1`,
      [referenceEdlSessionId],
    );
    const session = sQ.rows?.[0] || null;

    // 4) stats + preview items
    const statsQ = await this.pool.query(
      `SELECT
         COUNT(*)::int AS items,
         COUNT(DISTINCT COALESCE(section,'Divers'))::int AS sections
       FROM edl_items
       WHERE edl_session_id=$1`,
      [referenceEdlSessionId],
    );

    const itemsCount = statsQ.rows?.[0]?.items ?? 0;
    const sectionsCount = statsQ.rows?.[0]?.sections ?? 0;

    const previewQ = await this.pool.query(
      `SELECT id, section, label, entry_condition, entry_notes, exit_condition, exit_notes
       FROM edl_items
       WHERE edl_session_id=$1
       ORDER BY COALESCE(section,'Divers'), label
       LIMIT 12`,
      [referenceEdlSessionId],
    );

    return {
      ok: true,
      leaseId,
      unitId,
      updatedAt,
      referenceEdlSessionId,
      session,
      stats: { items: itemsCount, sections: sectionsCount },
      preview: previewQ.rows,
    };
  }
}
