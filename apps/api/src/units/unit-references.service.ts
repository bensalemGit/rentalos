import { BadRequestException, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class UnitReferencesService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  async getUnitReferences(unitId: string) {
    if (!unitId) throw new BadRequestException('Missing unitId');

    const rs = await this.pool.query(
      `SELECT unit_id, reference_edl_session_id, reference_inventory_session_id, updated_at
       FROM unit_reference_state
       WHERE unit_id=$1`,
      [unitId],
    );

    const row = rs.rows?.[0] || null;
    const referenceEdlSessionId = row?.reference_edl_session_id || null;
    const referenceInventorySessionId = row?.reference_inventory_session_id || null;

    // EDL summary
    let edl: any = { referenceEdlSessionId, session: null, stats: { items: 0, sections: 0 }, preview: [] };
    if (referenceEdlSessionId) {
      const sQ = await this.pool.query(
        `SELECT id, status, created_at FROM edl_sessions WHERE id=$1`,
        [referenceEdlSessionId],
      );
      const statsQ = await this.pool.query(
        `SELECT
           COUNT(*)::int AS items,
           COUNT(DISTINCT COALESCE(section,'Divers'))::int AS sections
         FROM edl_items
         WHERE edl_session_id=$1`,
        [referenceEdlSessionId],
      );
      const pQ = await this.pool.query(
        `SELECT id, section, label, entry_condition, exit_condition
         FROM edl_items
         WHERE edl_session_id=$1
         ORDER BY COALESCE(section,'Divers'), label
         LIMIT 12`,
        [referenceEdlSessionId],
      );

      edl = {
        referenceEdlSessionId,
        session: sQ.rows?.[0] || null,
        stats: {
          items: statsQ.rows?.[0]?.items ?? 0,
          sections: statsQ.rows?.[0]?.sections ?? 0,
        },
        preview: pQ.rows || [],
      };
    }

    // Inventory summary
    let inventory: any = { referenceInventorySessionId, session: null, stats: { lines: 0, categories: 0 }, preview: [] };
    if (referenceInventorySessionId) {
      const sQ = await this.pool.query(
        `SELECT id, status, created_at FROM inventory_sessions WHERE id=$1`,
        [referenceInventorySessionId],
      );
      const statsQ = await this.pool.query(
        `SELECT
           COUNT(*)::int AS lines,
           COUNT(DISTINCT COALESCE(ci.category,'Divers'))::int AS categories
         FROM inventory_lines il
         JOIN inventory_catalog_items ci ON ci.id = il.catalog_item_id
         WHERE il.inventory_session_id=$1`,
        [referenceInventorySessionId],
      );
      const pQ = await this.pool.query(
        `SELECT
           il.id,
           ci.category as category,
           ci.name as label,
           il.entry_qty, il.entry_state,
           il.exit_qty, il.exit_state
         FROM inventory_lines il
         JOIN inventory_catalog_items ci ON ci.id = il.catalog_item_id
         WHERE il.inventory_session_id=$1
         ORDER BY COALESCE(ci.category,'Divers'), ci.name
         LIMIT 12`,
        [referenceInventorySessionId],
      );

      inventory = {
        referenceInventorySessionId,
        session: sQ.rows?.[0] || null,
        stats: {
          lines: statsQ.rows?.[0]?.lines ?? 0,
          categories: statsQ.rows?.[0]?.categories ?? 0,
        },
        preview: pQ.rows || [],
      };
    }

    return {
      ok: true,
      unitId,
      updatedAt: row?.updated_at || null,
      edl,
      inventory,
    };
  }
}
