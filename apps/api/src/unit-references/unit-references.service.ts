import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from './unit-references.constants';

@Injectable()
export class UnitReferencesService {
  constructor(@Inject(PG_POOL) private readonly pool: any) {}

  async getUnitReferencesPreview(unitId: string) {
    if (!unitId) throw new BadRequestException("Missing unitId");

    const refQ = await this.pool.query(
      `SELECT
        unit_id,
        reference_edl_session_id,
        reference_inventory_session_id,
        updated_at
      FROM unit_reference_state
      WHERE unit_id=$1`,
      [unitId]
    );

    const state = refQ.rows?.[0] || null;

    const referenceEdlSessionId = state?.reference_edl_session_id || null;
    const referenceInventorySessionId =
      state?.reference_inventory_session_id || null;

    // ---- EDL preview ----
    let edl = null;
    if (referenceEdlSessionId) {
      const items = await this.pool.query(
        `SELECT section, label, entry_condition, exit_condition
         FROM edl_items
         WHERE edl_session_id=$1
         ORDER BY section, label`,
        [referenceEdlSessionId]
      );

      edl = {
        sessionId: referenceEdlSessionId,
        items: items.rows,
      };
    }

    // ---- Inventory preview ----
    let inventory = null;
    if (referenceInventorySessionId) {
      const lines = await this.pool.query(
        `SELECT
          ci.category,
          ci.name as label,
          l.entry_qty,
          l.exit_qty,
          l.entry_state,
          l.exit_state
        FROM inventory_lines l
        JOIN inventory_catalog_items ci ON ci.id = l.catalog_item_id
        WHERE l.inventory_session_id=$1
        ORDER BY ci.category, ci.name`,
        [referenceInventorySessionId]
      );

      inventory = {
        sessionId: referenceInventorySessionId,
        lines: lines.rows,
      };
    }

    return {
      ok: true,
      unitId,
      reference: {
        referenceEdlSessionId,
        referenceInventorySessionId,
      },
      edl,
      inventory,
    };
  }
}
