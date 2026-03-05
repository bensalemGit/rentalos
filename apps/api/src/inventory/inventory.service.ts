import { Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import * as crypto from 'crypto';

@Injectable()
export class InventoryService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  async listSessions(leaseId?: string) {
    if (leaseId) {
      const r = await this.pool.query(
        `SELECT * FROM inventory_sessions WHERE lease_id=$1 ORDER BY created_at DESC`,
        [leaseId],
      );
      return r.rows;
    }
    const r = await this.pool.query(`SELECT * FROM inventory_sessions ORDER BY created_at DESC`);
    return r.rows;
  }

  async createSession(leaseId: string, status?: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const normalized = String(status || 'entry').trim().toLowerCase();
    const finalStatus = normalized === 'draft' ? 'entry' : normalized;

    if (!['entry', 'exit'].includes(finalStatus)) {
      throw new BadRequestException(`Invalid Inventory status (expected entry|exit)`);
    }

    const r = await this.pool.query(
      `INSERT INTO inventory_sessions (lease_id, status)
       VALUES ($1,$2)
       RETURNING *`,
      [leaseId, finalStatus],
    );

    return r.rows[0];
  }

  async listLines(inventorySessionId: string) {
    if (!inventorySessionId) throw new BadRequestException('Missing inventorySessionId');

    const r = await this.pool.query(
      `SELECT
         il.id,
         il.inventory_session_id,
         il.catalog_item_id,
         il.ref_key,
         il.entry_qty,
         il.entry_state,
         il.entry_notes,
         il.exit_qty,
         il.exit_state,
         il.exit_notes,
         ci.category as category,
         ci.name as label,
         ci.default_qty as default_qty,
         ci.unit as unit
       FROM inventory_lines il
       JOIN inventory_catalog_items ci ON ci.id = il.catalog_item_id
       WHERE il.inventory_session_id = $1
       ORDER BY ci.category, ci.name`,
      [inventorySessionId],
    );

    return r.rows;
  }

  async updateLine(id: string, patch: any) {
    if (!id) throw new BadRequestException('Missing id');

    const allowed = new Set([
      'entry_qty',
      'entry_state',
      'entry_notes',
      'exit_qty',
      'exit_state',
      'exit_notes',
    ]);

    const keys = Object.keys(patch || {}).filter((k) => allowed.has(k));
    if (!keys.length) throw new BadRequestException('No valid fields');

    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;

    for (const k of keys) {
      sets.push(`${k}=$${i++}`);
      vals.push(patch[k]);
    }
    vals.push(id);

    const sql = `UPDATE inventory_lines SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`;
    const r = await this.pool.query(sql, vals);
    if (!r.rowCount) throw new BadRequestException('Unknown inventory line');
    return r.rows[0];
  }

  // ------------------------------------------------------------
  // ✅ Ajout/Suppression de lignes dans une session (sans template)
  // ------------------------------------------------------------
  async addLineToSession(
    inventorySessionId: string,
    category: string,
    name: string,
    unit: string,
    qty: number,
  ) {
    if (!inventorySessionId) throw new BadRequestException('Missing inventorySessionId');

    const cat = String(category || 'Divers').trim() || 'Divers';
    const nm = String(name || '').trim();
    const un = String(unit || 'piece').trim() || 'piece';
    const q = Number.isFinite(Number(qty)) ? Math.max(0, Number(qty)) : 1;

    if (!nm) throw new BadRequestException('Missing name/label');

    // 1) récupérer ou créer un catalog item
    let catalogId: string;

    const found = await this.pool.query(
      `SELECT id
       FROM inventory_catalog_items
       WHERE category=$1 AND name=$2 AND unit=$3
       LIMIT 1`,
      [cat, nm, un],
    );

    if (found.rowCount) {
      catalogId = found.rows[0].id;
    } else {
      catalogId = crypto.randomUUID();
      await this.pool.query(
        `INSERT INTO inventory_catalog_items (id, category, name, unit, default_qty)
         VALUES ($1,$2,$3,$4,$5)`,
        [catalogId, cat, nm, un, q || 1],
      );
    }

    // 2) prévenir doublon de ligne dans la session
    const exists = await this.pool.query(
      `SELECT id FROM inventory_lines WHERE inventory_session_id=$1 AND catalog_item_id=$2 LIMIT 1`,
      [inventorySessionId, catalogId],
    );
    if (exists.rowCount) {
      throw new BadRequestException(
        `Ligne déjà présente dans cette session (cat="${cat}", label="${nm}", unit="${un}")`,
      );
    }

    // 3) insérer line
    const lineId = crypto.randomUUID();
    const entryQty = q || 1;
    const entryState = 'OK';

    const refKey = crypto.randomUUID();

    const r = await this.pool.query(
      `INSERT INTO inventory_lines (
        id, inventory_session_id, catalog_item_id,
        ref_key,
        entry_qty, entry_state, entry_notes,
        exit_qty
      )
      VALUES ($1,$2,$3,$4,$5,$6,NULL,0)
      RETURNING *`,
      [lineId, inventorySessionId, catalogId, refKey, entryQty, entryState],
    );

    return r.rows[0];
  }

  async removeLineFromSession(lineId: string) {
    if (!lineId) throw new BadRequestException('Missing lineId');
    const r = await this.pool.query(`DELETE FROM inventory_lines WHERE id=$1 RETURNING id`, [lineId]);
    if (!r.rowCount) throw new BadRequestException('Unknown inventory line');
    return { ok: true, id: lineId };
  }

  async copyEntryToExitForSession(args: {
    exitSessionId: string;
    fromSessionId?: string;
  }) {
    const { exitSessionId, fromSessionId } = args;

    if (!exitSessionId) throw new BadRequestException('Missing exitSessionId');

    // 1) Vérifier la session exit + récupérer lease_id + created_at
    const exitQ = await this.pool.query(
      `SELECT id, lease_id, status, created_at FROM inventory_sessions WHERE id=$1`,
      [exitSessionId],
    );
    if (!exitQ.rowCount) throw new BadRequestException('Unknown exitSessionId');

    const exitSession = exitQ.rows[0];
    if (String(exitSession.status) !== 'exit') {
      throw new BadRequestException(`Target session must be status='exit' (got ${exitSession.status})`);
    }

    const leaseId = exitSession.lease_id;

    // 2) Choisir la source entry
    let entrySessionId = fromSessionId;

    if (entrySessionId) {
      const entryQ = await this.pool.query(
        `SELECT id FROM inventory_sessions WHERE id=$1 AND lease_id=$2 AND status='entry' LIMIT 1`,
        [entrySessionId, leaseId],
      );
      if (!entryQ.rowCount) {
        throw new BadRequestException('fromSessionId must be an entry session of the same lease');
      }
    } else {
      const entryQ = await this.pool.query(
        `SELECT id FROM inventory_sessions
        WHERE lease_id=$1 AND status='entry' AND created_at <= $2
        ORDER BY created_at DESC
        LIMIT 1`,
        [leaseId, exitSession.created_at],
      );
      if (!entryQ.rowCount) {
        throw new BadRequestException('No entry session found before this exit session');
      }
      entrySessionId = entryQ.rows[0].id;
    }

    // 2bis) Si la session EXIT est vide, cloner les lignes depuis la session ENTRY
    const exitCountQ = await this.pool.query(
      `SELECT COUNT(*)::int AS n FROM inventory_lines WHERE inventory_session_id=$1`,
      [exitSessionId],
    );
    const exitLinesCount = exitCountQ.rows?.[0]?.n ?? 0;

    let insertedCount = 0;

    if (exitLinesCount === 0) {
      const srcQ = await this.pool.query(
        `SELECT catalog_item_id, ref_key, entry_qty, entry_state, entry_notes
        FROM inventory_lines
        WHERE inventory_session_id=$1`,
        [entrySessionId],
      );

      for (const ln of srcQ.rows) {
        await this.pool.query(
          `INSERT INTO inventory_lines (
             id, inventory_session_id, catalog_item_id,
             ref_key,
             entry_qty, entry_state, entry_notes,
             exit_qty, exit_state, exit_notes
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            crypto.randomUUID(),
            exitSessionId,
            ln.catalog_item_id,
            ln.ref_key ?? (ln.catalog_item_id?.toString?.() ?? crypto.randomUUID()),
            ln.entry_qty ?? 0,
            ln.entry_state ?? 'OK',
            ln.entry_notes ?? null,
            // préremplissage sortie = entrée
            ln.entry_qty ?? 0,
            ln.entry_state ?? 'OK',
            ln.entry_notes ?? null,
          ],
        );
        insertedCount++;
      }
    }       

    // 3) Copier entry_* -> exit_* SUR LA SESSION EXIT (idempotent: on ne remplit que si vide)
    const r = await this.pool.query(
      `UPDATE inventory_lines
      SET
        exit_qty = CASE
          WHEN COALESCE(exit_qty, 0) = 0 THEN COALESCE(entry_qty, 0)
          ELSE exit_qty
        END,
        exit_state = CASE
          WHEN exit_state IS NULL OR btrim(exit_state) = '' OR lower(btrim(exit_state)) IN ('ok','--','-')
            THEN entry_state
          ELSE exit_state
        END,
        exit_notes = CASE
          WHEN exit_notes IS NULL OR btrim(exit_notes) = ''
            THEN entry_notes
          ELSE exit_notes
        END
      WHERE inventory_session_id = $1`,
      [exitSessionId],
    );

    return { ok: true, exitSessionId, entrySessionId, insertedCount, updatedCount: r.rowCount };
  }


  // Legacy endpoint: copy entry -> exit for "latest exit session" of a lease
  async copyEntryToExit(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    // Prendre la dernière session EXIT (pas latest global)
    const exitQ = await this.pool.query(
      `SELECT id FROM inventory_sessions WHERE lease_id=$1 AND status='exit' ORDER BY created_at DESC LIMIT 1`,
      [leaseId],
    );

    if (!exitQ.rowCount) {
      throw new BadRequestException('No exit inventory session for this lease (create an exit session first)');
    }

    return this.copyEntryToExitForSession({ exitSessionId: exitQ.rows[0].id });
  }

  // ------------------------------------------------------------
  // ✅ Référence logement (unit_reference_state.reference_inventory_session_id)
  // ------------------------------------------------------------
  async setInventoryReferenceFromLease(leaseId: string, inventorySessionId?: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    let sid = inventorySessionId;
    if (!sid) {
      const sQ = await this.pool.query(
        `SELECT id FROM inventory_sessions WHERE lease_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [leaseId],
      );
      if (!sQ.rowCount) throw new BadRequestException('No inventory session for this lease');
      sid = sQ.rows[0].id;
    }

    const sessionQ = await this.pool.query(
      `SELECT id, lease_id, unit_id, status
      FROM inventory_sessions
      WHERE id=$1`,
      [sid],
    );

    if (!sessionQ.rowCount) {
      throw new BadRequestException("Inventory session not found");
    }

    const session = sessionQ.rows[0];

    if (String(session.lease_id) !== String(leaseId)) {
      throw new BadRequestException("Inventory session does not belong to this lease");
    }

    const unitId = session.unit_id;
    const status = String(session.status || "").toLowerCase();
    const mode = status === "exit" ? "update_reference" : "set_reference";

    await this.pool.query(
      `INSERT INTO unit_reference_state (unit_id, reference_inventory_session_id)
       VALUES ($1,$2)
       ON CONFLICT (unit_id)
       DO UPDATE SET reference_inventory_session_id = EXCLUDED.reference_inventory_session_id`,
      [unitId, sid],
    );

    return {
      ok: true,
      unitId,
      referenceInventorySessionId: sid,
      mode, // set_reference | update_reference
    };
  }

  // ------------------------------------------------------------
  // ✅ Apply reference → lease (création nouvelle session clonée)
  // ------------------------------------------------------------
  async applyInventoryReferenceToLease(leaseId: string, status: string = 'entry') {
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
        `SELECT reference_inventory_session_id
         FROM unit_reference_state
         WHERE unit_id=$1`,
        [unitId],
      );
      const refId = refQ.rows?.[0]?.reference_inventory_session_id;
      if (!refId) throw new BadRequestException(`No Inventory reference for unit ${unitId}`);

      const newSessionId = crypto.randomUUID();
      const sIns = await client.query(
        `INSERT INTO inventory_sessions (id, lease_id, status)
         VALUES ($1,$2,$3)
         RETURNING *`,
        [newSessionId, leaseId, finalStatus],
      );

      const linesQ = await client.query(
        `SELECT catalog_item_id, ref_key, entry_qty, entry_state, entry_notes
         FROM inventory_lines
         WHERE inventory_session_id=$1`,
        [refId],
      );

      for (const ln of linesQ.rows) {
        const entryQty = ln.entry_qty ?? 0;
        const entryState = ln.entry_state ?? 'OK';
        const entryNotes = ln.entry_notes ?? null;

        await client.query(
          `INSERT INTO inventory_lines (
             id,
             inventory_session_id,
             catalog_item_id,
             ref_key,
             entry_qty,
             entry_state,
             entry_notes,
             exit_qty,
             exit_state,
             exit_notes
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,0,NULL,NULL)`,
          [
            crypto.randomUUID(),
            newSessionId,
            ln.catalog_item_id,
            ln.ref_key ?? (ln.catalog_item_id?.toString?.() ?? crypto.randomUUID()),
            entryQty,
            entryState,
            entryNotes,
          ],
        );
      }

      await client.query('COMMIT');
      return {
        ok: true,
        leaseId,
        unitId,
        referenceInventorySessionId: refId,
        inventorySessionId: sIns.rows[0].id,
        status: finalStatus,
        createdLines: linesQ.rowCount,
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
  // ✅ GET Référence logement Inventaire (par leaseId) + preview
  // ------------------------------------------------------------
  async getInventoryReferenceForLease(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const u = await this.pool.query(`SELECT unit_id FROM leases WHERE id=$1`, [leaseId]);
    if (!u.rowCount) throw new BadRequestException(`Unknown leaseId: ${leaseId}`);
    const unitId = u.rows[0].unit_id;

    const refQ = await this.pool.query(
      `SELECT reference_inventory_session_id, updated_at
       FROM unit_reference_state
       WHERE unit_id=$1`,
      [unitId],
    );

    const referenceInventorySessionId = refQ.rows?.[0]?.reference_inventory_session_id || null;
    const updatedAt = refQ.rows?.[0]?.updated_at || null;

    if (!referenceInventorySessionId) {
      return {
        ok: true,
        leaseId,
        unitId,
        updatedAt,
        referenceInventorySessionId: null,
        session: null,
        stats: { lines: 0, categories: 0 },
        preview: [],
      };
    }

    const sQ = await this.pool.query(
      `SELECT id, status, created_at, lease_id, unit_id
       FROM inventory_sessions
       WHERE id=$1`,
      [referenceInventorySessionId],
    );
    const session = sQ.rows?.[0] || null;

    const statsQ = await this.pool.query(
      `SELECT
         COUNT(*)::int AS lines,
         COUNT(DISTINCT COALESCE(ci.category,'Divers'))::int AS categories
       FROM inventory_lines il
       JOIN inventory_catalog_items ci ON ci.id = il.catalog_item_id
       WHERE il.inventory_session_id=$1`,
      [referenceInventorySessionId],
    );

    const linesCount = statsQ.rows?.[0]?.lines ?? 0;
    const categoriesCount = statsQ.rows?.[0]?.categories ?? 0;

    const previewQ = await this.pool.query(
      `SELECT
         il.id,
         il.catalog_item_id,
         il.entry_qty,
         il.entry_state,
         il.entry_notes,
         il.exit_qty,
         il.exit_state,
         il.exit_notes,
         ci.category as category,
         ci.name as label,
         ci.default_qty as default_qty,
         ci.unit as unit
       FROM inventory_lines il
       JOIN inventory_catalog_items ci ON ci.id = il.catalog_item_id
       WHERE il.inventory_session_id=$1
       ORDER BY COALESCE(ci.category,'Divers'), ci.name
       LIMIT 12`,
      [referenceInventorySessionId],
    );

    return {
      ok: true,
      leaseId,
      unitId,
      updatedAt,
      referenceInventorySessionId,
      session,
      stats: { lines: linesCount, categories: categoriesCount },
      preview: previewQ.rows,
    };
  }

  // ------------------------------------------------------------
  // ✅ Diff entry vs exit (par ref_key si possible)
  // GET /inventory/sessions/:id/diff
  // ------------------------------------------------------------
  async diffForLease(sessionId: string) {
    if (!sessionId) throw new BadRequestException('Missing sessionId');

    const sQ = await this.pool.query(
      `SELECT id, lease_id, status, created_at
       FROM inventory_sessions
       WHERE id=$1`,
      [sessionId],
    );
    if (!sQ.rowCount) throw new BadRequestException('Unknown inventory session');

    const base = sQ.rows[0] as { id: string; lease_id: string; status: string; created_at: string };
    const leaseId = base.lease_id;
    const baseStatus = String(base.status || '').toLowerCase();

    let entrySessionId: string | null = null;
    let exitSessionId: string | null = null;

    if (baseStatus === 'exit') {
      exitSessionId = base.id;

      const entryQ = await this.pool.query(
        `SELECT id
         FROM inventory_sessions
         WHERE lease_id=$1 AND status='entry' AND created_at <= $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [leaseId, base.created_at],
      );
      entrySessionId = entryQ.rows?.[0]?.id ?? null;
    } else {
      entrySessionId = base.id;

      const exitAfterQ = await this.pool.query(
        `SELECT id
         FROM inventory_sessions
         WHERE lease_id=$1 AND status='exit' AND created_at >= $2
         ORDER BY created_at ASC
         LIMIT 1`,
        [leaseId, base.created_at],
      );
      exitSessionId = exitAfterQ.rows?.[0]?.id ?? null;

      if (!exitSessionId) {
        const exitLastQ = await this.pool.query(
          `SELECT id
           FROM inventory_sessions
           WHERE lease_id=$1 AND status='exit'
           ORDER BY created_at DESC
           LIMIT 1`,
          [leaseId],
        );
        exitSessionId = exitLastQ.rows?.[0]?.id ?? null;
      }
    }

    // Lines + ref_key (listLines ne remonte pas ref_key dans ton SELECT actuel)
    const entryLines = entrySessionId ? (await this.listLines(entrySessionId)) : [];
    const exitLines = exitSessionId ? (await this.listLines(exitSessionId)) : [];

    const entryRefQ = entrySessionId
      ? await this.pool.query(
          `SELECT id, ref_key
           FROM inventory_lines
           WHERE inventory_session_id=$1`,
          [entrySessionId],
        )
      : { rows: [] as any[] };

    const exitRefQ = exitSessionId
      ? await this.pool.query(
          `SELECT id, ref_key
           FROM inventory_lines
           WHERE inventory_session_id=$1`,
          [exitSessionId],
        )
      : { rows: [] as any[] };

    const refByIdEntry = new Map<string, string>();
    for (const r of entryRefQ.rows) if (r?.id && r?.ref_key) refByIdEntry.set(String(r.id), String(r.ref_key));

    const refByIdExit = new Map<string, string>();
    for (const r of exitRefQ.rows) if (r?.id && r?.ref_key) refByIdExit.set(String(r.id), String(r.ref_key));

    const entryEnriched = entryLines.map((ln: any) => ({
      ...ln,
      ref_key: refByIdEntry.get(String(ln.id)) ?? null,
    }));
    const exitEnriched = exitLines.map((ln: any) => ({
      ...ln,
      ref_key: refByIdExit.get(String(ln.id)) ?? null,
    }));

    const rows = buildInventoryDiff(entryEnriched, exitEnriched);

    return {
      ok: true,
      leaseId,
      baseSessionId: base.id,
      entrySessionId,
      exitSessionId,
      rows,
      counts: {
        entryLines: entryLines.length,
        exitLines: exitLines.length,
        diffs: rows.length,
      },
    };
  }

}

function normStr(x: any): string | null {
  const s = x === undefined || x === null ? null : String(x);
  const t = s?.trim();
  return t ? t : null;
}
function normNum(x: any): number | null {
  if (x === undefined || x === null || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function invCategory(ln: any): string {
  return normStr(ln?.category) ?? 'Divers';
}
function invLabel(ln: any): string {
  return normStr(ln?.label) ?? normStr(ln?.catalog_label) ?? '';
}

function invKey(ln: any): string {
  const rk = normStr(ln?.ref_key);
  if (rk) return `ref:${rk}`;

  const c = invCategory(ln).toLowerCase();
  const l = invLabel(ln).toLowerCase();
  return `cl:${c}__${l}`;
}

function buildInventoryDiff(entryLines: any[], exitLines: any[]) {
  const emap = new Map<string, any>();
  const xmap = new Map<string, any>();

  for (const ln of entryLines || []) emap.set(invKey(ln), ln);
  for (const ln of exitLines || []) xmap.set(invKey(ln), ln);

  const keys = new Set<string>([...emap.keys(), ...xmap.keys()]);
  const out: any[] = [];

  for (const k of Array.from(keys).sort()) {
    const e = emap.get(k);
    const x = xmap.get(k);

    const category = invCategory(e ?? x);
    const label = invLabel(e ?? x);
    const unit = normStr(e?.unit ?? x?.unit);

    const entry_qty = normNum(e?.entry_qty);
    const entry_state = normStr(e?.entry_state);
    const entry_notes = normStr(e?.entry_notes);

    const exit_qty = normNum(x?.exit_qty);
    const exit_state = normStr(x?.exit_state);
    const exit_notes = normStr(x?.exit_notes);

    const kind = e && !x ? 'removed' : !e && x ? 'added' : 'changed';

    if (kind === 'changed') {
      const same =
        entry_qty === exit_qty &&
        entry_state === exit_state &&
        entry_notes === exit_notes;
      if (same) continue;
    }

    out.push({
      key: k,
      category,
      label,
      unit,
      kind,
      entry_qty,
      entry_state,
      entry_notes,
      exit_qty,
      exit_state,
      exit_notes,
    });
  }

  return out;
}

