import { Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import * as crypto from 'crypto';

type EdlItemDef = { section: string; label: string; sort_order: number };
type InvItemDef = {
  category: string;
  name: string;
  unit: string;
  default_qty: number;
  sort_order: number;
};

type ImportHousingDto = {
  leaseId?: string;
  lease_id?: string;

  typology?: string; // STUDIO | T1 | T2 | ...
  furnished?: boolean; // pas utilisé pour le choix template (règle actuelle)
  duplex?: boolean;
  variants?: string[]; // BALCON, TERRASSE, ...

  mode?: 'block_if_data' | 'merge'; // merge pas activé pour le moment
};

type ImportHousingArg = ImportHousingDto | string;

type TemplateQuery = {
  code: string;
  isDuplex: boolean;
  variants: string[];
};

@Injectable()
export class ImportService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  private defaultItemState: string | null = null;
  private defaultConditionGrade: string | null = null;

  /**
   * Import d'un modèle logement en DB pour un bail:
   * - crée une session EDL + items
   * - crée une session inventaire + lignes
   * - optionnel: ajoute les variantes (BALCON/TERRASSE/...)
   *
   * ⚠️ Pour l'instant, seul le mode `block_if_data` est supporté.
   */
  async importHousing(arg1: ImportHousingArg) {
    // 1) Resolve leaseId
    const leaseId =
      typeof arg1 === 'string'
        ? arg1
        : (arg1?.leaseId || (arg1 as any)?.lease_id || '');

    if (!leaseId) throw new BadRequestException('Missing leaseId');

    // 2) Resolve mode (merge => pas encore supporté)
    const mode: 'block_if_data' | 'merge' =
      typeof arg1 === 'string'
        ? 'block_if_data'
        : ((arg1 as ImportHousingDto)?.mode || 'block_if_data');

    if (mode !== 'block_if_data') {
      throw new BadRequestException(
        'Mode "merge" non activé pour le moment. Utilise "block_if_data".',
      );
    }

    // 3) Load lease (unit_id)
    const lease = await this.getLease(leaseId);

    // 4) Resolve template by typology + duplex, puis charger items base + variantes
    const dto = typeof arg1 === 'string' ? ({} as ImportHousingDto) : (arg1 as ImportHousingDto);

    const code = this.normalizeTemplateCode(dto?.typology);
    const isDuplex = !!dto?.duplex;

    const variants = Array.isArray(dto?.variants)
      ? dto.variants.map((v) => String(v).trim().toUpperCase()).filter(Boolean)
      : [];

    const tpl = await this.getTemplateFromDb({ code, isDuplex, variants });
    if (!tpl) {
      throw new BadRequestException(
        `No template found for typology=${code} duplex=${isDuplex}`,
      );
    }

    // 5) block_if_data safety
    const hasEdl = await this.leaseHasEdlSessions(leaseId);
    const hasInv = await this.leaseHasInventorySessions(leaseId);
    if (hasEdl || hasInv) {
      throw new BadRequestException(
        'Import bloqué: ce bail a déjà des données EDL/Inventaire. Crée un nouveau bail (ou on activera "merge" plus tard).',
      );
    }

    // 6) Create sessions
    const edlSession = await this.createEdlSession(leaseId, lease.unit_id, 'entry');
    const invSession = await this.createInventorySession(leaseId, lease.unit_id, 'entry');

    // 7) Insert items/lines
    await this.insertEdlItems(edlSession.id, tpl.edlItems);
    await this.ensureCatalogAndInsertInventoryLines(invSession.id, tpl.inventoryItems);

    // 8) Save as unit reference
    await this.setUnitReference(lease.unit_id, edlSession.id, invSession.id);

    // ✅ Payload compatible avec ta page UI actuelle
    return {
      ok: true,
      leaseId,
      typology: String(dto?.typology || '').trim() || code.toUpperCase(),
      furnished: !!dto?.furnished,
      duplex: isDuplex,
      variants,
      mode,
      templateId: tpl.templateId,
      edl: {
        sessionId: edlSession.id,
        itemsCount: tpl.edlItems.length,
      },
      inventory: {
        sessionId: invSession.id,
        itemsCount: tpl.inventoryItems.length,
      },
    };
  }

  // -------------------------
  // Lease helpers
  // -------------------------
  private async getLease(leaseId: string): Promise<{ id: string; unit_id: string }> {
    const r = await this.pool.query(`SELECT id, unit_id FROM leases WHERE id=$1`, [leaseId]);
    if (!r.rowCount) throw new BadRequestException(`Unknown leaseId: ${leaseId}`);
    return r.rows[0];
  }

  private async leaseHasEdlSessions(leaseId: string): Promise<boolean> {
    const r = await this.pool.query(`SELECT 1 FROM edl_sessions WHERE lease_id=$1 LIMIT 1`, [leaseId]);
    return !!r.rowCount;
  }

  private async leaseHasInventorySessions(leaseId: string): Promise<boolean> {
    const r = await this.pool.query(`SELECT 1 FROM inventory_sessions WHERE lease_id=$1 LIMIT 1`, [leaseId]);
    return !!r.rowCount;
  }

  // -------------------------
  // Template resolution
  // -------------------------
  private normalizeTemplateCode(typology?: string): string {
    const t = String(typology || '').trim().toUpperCase();
    if (!t) return 't2'; // fallback raisonnable
    if (t === 'STUDIO') return 'studio';
    if (/^T\d+$/.test(t)) return t.toLowerCase();
    return String(typology).trim().toLowerCase();
  }

  private async getTemplateFromDb(arg: TemplateQuery): Promise<{ templateId: string; edlItems: EdlItemDef[]; inventoryItems: InvItemDef[] } | null> {
    // 1) pick template row
    const tplRow = await this.pool.query(
      `SELECT id, code, bedrooms_count, rooms_count, is_duplex, label
       FROM unit_templates
       WHERE code=$1 AND is_duplex=$2
       ORDER BY bedrooms_count DESC, rooms_count DESC
       LIMIT 1`,
      [arg.code, arg.isDuplex],
    );
    if (!tplRow.rowCount) return null;

    const templateId = String(tplRow.rows[0].id);

    // 2) base EDL items
    const edlBase = await this.pool.query(
      `SELECT section, label, sort_order
       FROM unit_template_edl_items
       WHERE template_id=$1
       ORDER BY sort_order ASC, section ASC, label ASC`,
      [templateId],
    );

    // 3) base inventory items
    const invBase = await this.pool.query(
      `SELECT category, name, unit, default_qty, sort_order
       FROM unit_template_inventory_items
       WHERE template_id=$1
       ORDER BY sort_order ASC, category ASC, name ASC`,
      [templateId],
    );

    // 4) variants (optional)
    let edlVarRows: any[] = [];
    let invVarRows: any[] = [];

    if (arg.variants.length) {
      const edlVar = await this.pool.query(
        `SELECT section, label, sort_order
         FROM unit_template_edl_variant_items
         WHERE template_id=$1 AND variant_code = ANY($2)
         ORDER BY sort_order ASC, section ASC, label ASC`,
        [templateId, arg.variants],
      );
      edlVarRows = edlVar.rows;

      const invVar = await this.pool.query(
        `SELECT category, name, unit, default_qty, sort_order
         FROM unit_template_inventory_variant_items
         WHERE template_id=$1 AND variant_code = ANY($2)
         ORDER BY sort_order ASC, category ASC, name ASC`,
        [templateId, arg.variants],
      );
      invVarRows = invVar.rows;
    }

    const edlItems: EdlItemDef[] = [...edlBase.rows, ...edlVarRows].map((r: any) => ({
      section: String(r.section),
      label: String(r.label),
      sort_order: Number(r.sort_order ?? 0),
    }));

    const inventoryItems: InvItemDef[] = [...invBase.rows, ...invVarRows].map((r: any) => ({
      category: String(r.category),
      name: String(r.name),
      unit: String(r.unit || 'piece'),
      default_qty: Number(r.default_qty ?? 1),
      sort_order: Number(r.sort_order ?? 0),
    }));

    return { templateId, edlItems, inventoryItems };
  }

  // -------------------------
  // Create Sessions
  // -------------------------
  private async createEdlSession(leaseId: string, unitId: string, status: string) {
    const normalized = String(status || '').trim().toLowerCase();
    if (!['entry', 'exit'].includes(normalized)) {
      throw new BadRequestException(`Invalid EDL status (expected entry|exit)`);
    }
    if (!unitId) throw new BadRequestException('Missing unitId');

    const r = await this.pool.query(
      `INSERT INTO edl_sessions (lease_id, unit_id, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [leaseId, unitId, normalized],
    );
    return r.rows[0];
  }

  private async createInventorySession(leaseId: string, unitId: string, status: string) {
    const normalized = String(status || '').trim().toLowerCase();
    if (!['entry', 'exit'].includes(normalized)) {
      throw new BadRequestException(`Invalid Inventory status (expected entry|exit)`);
    }
    if (!unitId) throw new BadRequestException('Missing unitId');

    const r = await this.pool.query(
      `INSERT INTO inventory_sessions (lease_id, unit_id, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [leaseId, unitId, normalized],
    );
    return r.rows[0];
  }

  // -------------------------
  // Insert EDL items
  // -------------------------
  private async insertEdlItems(edlSessionId: string, items: EdlItemDef[]) {
    const defaultCond = await this.getDefaultConditionGrade();

    for (const it of items) {
      await this.pool.query(
        `INSERT INTO edl_items (
           id, edl_session_id, section, label,
           entry_condition, entry_notes,
           exit_condition, exit_notes
         )
         VALUES ($1,$2,$3,$4,$5,NULL,$6,NULL)`,
        [
          crypto.randomUUID(),
          edlSessionId,
          it.section,
          it.label,
          defaultCond,
          defaultCond,
        ],
      );
    }
  }

  // -------------------------
  // Inventory catalog + lines
  // -------------------------
  private async ensureCatalogAndInsertInventoryLines(inventorySessionId: string, items: InvItemDef[]) {
    const defaultState = await this.getDefaultItemState();

    for (const it of items) {
      const catalogId = await this.getOrCreateCatalogItem(it.category, it.name, it.unit, it.default_qty);

      await this.pool.query(
        `INSERT INTO inventory_lines (
           id,
           inventory_session_id,
           catalog_item_id,
           entry_qty,
           entry_state,
           entry_notes,
           exit_qty,
           exit_state,
           exit_notes
         )
         VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,NULL)`,
        [
          crypto.randomUUID(),
          inventorySessionId,
          catalogId,
          it.default_qty,
          defaultState,
          0,
          defaultState,
        ],
      );
    }
  }

  private async getOrCreateCatalogItem(category: string, name: string, unit: string, defaultQty: number): Promise<string> {
    const u = String(unit || 'piece');

    const r = await this.pool.query(
      `SELECT id FROM inventory_catalog_items WHERE category=$1 AND name=$2 AND unit=$3 LIMIT 1`,
      [category, name, u],
    );
    if (r.rowCount) return r.rows[0].id;

    const ins = await this.pool.query(
      `INSERT INTO inventory_catalog_items (id, category, name, unit, default_qty)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [crypto.randomUUID(), category, name, u, defaultQty],
    );
    return ins.rows[0].id;
  }

  // -------------------------
  // Defaults
  // -------------------------
  private async getDefaultItemState(): Promise<string> {
    if (this.defaultItemState) return this.defaultItemState;
    this.defaultItemState = 'OK';
    return this.defaultItemState;
  }

  private async getDefaultConditionGrade(): Promise<string> {
    if (this.defaultConditionGrade) return this.defaultConditionGrade;

    const r = await this.pool.query(
      `SELECT e.enumlabel
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'condition_grade'
       ORDER BY e.enumsortorder`,
    );

    const vals: string[] = r.rows.map((row: { enumlabel: string }) => row.enumlabel);
    const preferred = vals.includes('Bon') ? 'Bon' : vals.includes('bon') ? 'bon' : (vals[0] || 'Bon');

    this.defaultConditionGrade = preferred;
    return preferred;
  }

  // -------------------------
  // Set unit reference
  // -------------------------
  private async setUnitReference(unitId: string, edlSessionId: string, inventorySessionId: string) {
    if (!unitId) throw new BadRequestException('Missing unitId');

    await this.pool.query(
      `INSERT INTO unit_reference_state (unit_id, reference_edl_session_id, reference_inventory_session_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (unit_id)
       DO UPDATE SET
         reference_edl_session_id = EXCLUDED.reference_edl_session_id,
         reference_inventory_session_id = EXCLUDED.reference_inventory_session_id,
         updated_at = now()`,
      [unitId, edlSessionId, inventorySessionId],
    );
  }
}
