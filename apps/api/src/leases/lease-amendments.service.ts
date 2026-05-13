import { BadRequestException, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class LeaseAmendmentsService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });
  private storageBase = process.env.STORAGE_BASE_PATH || '/storage';
  private gotenberg = process.env.GOTENBERG_URL || 'http://gotenberg:3000';

  private ensureDir(p: string) {
    fs.mkdirSync(p, { recursive: true });
  }

  private sha256Buffer(buf: Buffer) {
    return crypto.createHash('sha256').update(buf).digest('hex');
  }

  private escapeHtml(s: any) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  private formatDateFr(value: any) {
    if (!value) return '—';

    let iso = '';

    if (value instanceof Date) {
      iso = value.toISOString().slice(0, 10);
    } else {
      const s = String(value).trim();
      const mIso = s.match(/^(\d{4}-\d{2}-\d{2})/);
      if (mIso) iso = mIso[1];
      else {
        const d = new Date(s);
        if (!Number.isNaN(d.getTime())) iso = d.toISOString().slice(0, 10);
        else return s;
      }
    }

    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  private euros(cents: any) {
    return `${(Number(cents || 0) / 100).toFixed(2)} €`;
  }

  private async htmlToPdfBuffer(html: string): Promise<Buffer> {
    const form = new FormData();

    form.append(
      'files',
      new Blob([new Uint8Array(Buffer.from(html, 'utf-8'))], {
        type: 'text/html',
      }),
      'index.html',
    );

    const resp = await fetch(`${this.gotenberg}/forms/chromium/convert/html`, {
      method: 'POST',
      body: form as any,
    });

    if (!resp.ok) {
      throw new BadRequestException(
        `Amendment PDF generation failed: ${await resp.text()}`,
      );
    }

    return Buffer.from(await resp.arrayBuffer());
  }

  async list(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const q = await this.pool.query(
      `
      SELECT
        a.*,
        d.filename AS document_filename,
        d.storage_path AS document_storage_path,
        sf.filename AS signed_final_filename,
        sf.storage_path AS signed_final_storage_path,
        COALESCE(signers.signers_json, '[]'::jsonb) AS signers
      FROM lease_amendments a
      LEFT JOIN documents d ON d.id = a.document_id
      LEFT JOIN documents sf ON sf.id = a.signed_final_document_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'role', s.role,
            'tenantId', s.tenant_id,
            'signerName', s.signer_name,
            'signerEmail', s.signer_email,
            'signatureStatus', s.signature_status,
            'signedAt', s.signed_at
          )
          ORDER BY
            CASE WHEN s.role = 'BAILLEUR' THEN 0 ELSE 1 END,
            s.created_at ASC
        ) AS signers_json
        FROM lease_amendment_signers s
        WHERE s.amendment_id = a.id
      ) signers ON TRUE
      WHERE a.lease_id = $1
      ORDER BY a.created_at DESC
      `,
      [leaseId],
    );

    return q.rows;
  }

  async get(leaseId: string, amendmentId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    if (!amendmentId) throw new BadRequestException('Missing amendmentId');

    const q = await this.pool.query(
      `
      SELECT *
      FROM lease_amendments
      WHERE id = $1
        AND lease_id = $2
      LIMIT 1
      `,
      [amendmentId, leaseId],
    );

    if (!q.rowCount) throw new BadRequestException('Unknown amendment');
    return q.rows[0];
  }

  async create(leaseId: string, body: any) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const type = String(body?.type || '').trim().toUpperCase();
    if (type !== 'ADD_TENANT') {
      throw new BadRequestException('Unsupported amendment type for now');
    }

    const effectiveDate = String(body?.effectiveDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
      throw new BadRequestException('Invalid effectiveDate');
    }

    const tenantIdsToAdd = Array.isArray(body?.tenantIdsToAdd)
      ? body.tenantIdsToAdd.map((x: any) => String(x || '').trim()).filter(Boolean)
      : [];

    if (!tenantIdsToAdd.length) {
      throw new BadRequestException('tenantIdsToAdd is required');
    }

    const extraChargesCentsPerTenant = Number(body?.extraChargesCentsPerTenant ?? 7000);
    if (!Number.isInteger(extraChargesCentsPerTenant) || extraChargesCentsPerTenant < 0) {
      throw new BadRequestException('Invalid extraChargesCentsPerTenant');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const leaseQ = await client.query(
        `
        SELECT l.*, u.code AS unit_code
        FROM leases l
        JOIN units u ON u.id = l.unit_id
        WHERE l.id = $1
        LIMIT 1
        `,
        [leaseId],
      );

      if (!leaseQ.rowCount) throw new BadRequestException('Unknown leaseId');

      const amountQ = await client.query(
        `
        SELECT rent_cents, charges_cents, deposit_cents, payment_day
        FROM lease_amounts
        WHERE lease_id = $1
          AND effective_date <= $2::date
        ORDER BY effective_date DESC
        LIMIT 1
        `,
        [leaseId, effectiveDate],
      );

      if (!amountQ.rowCount) {
        throw new BadRequestException('No lease_amounts row for this lease/effectiveDate');
      }

      const currentChargesCents = Number(amountQ.rows[0].charges_cents || 0);
      const extraTotalCents = extraChargesCentsPerTenant * tenantIdsToAdd.length;
      const newChargesCents = currentChargesCents + extraTotalCents;

      const tenantsQ = await client.query(
        `
        SELECT id, full_name, email
        FROM tenants
        WHERE id = ANY($1::uuid[])
        ORDER BY full_name ASC
        `,
        [tenantIdsToAdd],
      );

      if (tenantsQ.rowCount !== tenantIdsToAdd.length) {
        throw new BadRequestException('One or more tenants not found');
      }

      const alreadyQ = await client.query(
        `
        SELECT tenant_id
        FROM lease_tenants
        WHERE lease_id = $1
          AND tenant_id = ANY($2::uuid[])
        `,
        [leaseId, tenantIdsToAdd],
      );

      if (alreadyQ.rowCount) {
        throw new BadRequestException('One or more tenants are already attached to this lease');
      }

      const landlordQ = await client.query(
        `
        SELECT COALESCE(pl.name, lp.name, p.name, 'Bailleur') AS landlord_name,
               COALESCE(pl.email, lp.email, '') AS landlord_email
        FROM leases l
        JOIN units u ON u.id = l.unit_id
        LEFT JOIN projects p ON p.id = u.project_id
        LEFT JOIN project_landlords pl ON pl.id = p.landlord_id
        LEFT JOIN landlord_profiles lp ON lp.id = p.landlord_profile_id
        WHERE l.id = $1
        LIMIT 1
        `,
        [leaseId],
      );

      const landlordName = String(landlordQ.rows[0]?.landlord_name || 'Bailleur').trim();
      const landlordEmail = String(landlordQ.rows[0]?.landlord_email || '').trim();

      const title = `Avenant d’ajout de locataire`;
      const summary =
        `Ajout de ${tenantIdsToAdd.length} locataire(s) à compter du ${effectiveDate}. ` +
        `Charges : ${(currentChargesCents / 100).toFixed(2)} € → ${(newChargesCents / 100).toFixed(2)} €.`;

      const payload = {
        tenantIdsToAdd,
        effectiveDate,
        extraChargesCentsPerTenant,
        previousChargesCents: currentChargesCents,
        newChargesCents,
        extraTotalCents,
        rentCents: Number(amountQ.rows[0].rent_cents || 0),
        depositCents: Number(amountQ.rows[0].deposit_cents || 0),
        paymentDay: Number(amountQ.rows[0].payment_day || leaseQ.rows[0].payment_day || 1),
      };

      const ins = await client.query(
        `
        INSERT INTO lease_amendments (
          lease_id, type, status, effective_date, title, summary, payload_json
        )
        VALUES ($1, 'ADD_TENANT', 'draft', $2::date, $3, $4, $5::jsonb)
        RETURNING *
        `,
        [leaseId, effectiveDate, title, summary, JSON.stringify(payload)],
      );

      const amendment = ins.rows[0];

      await client.query(
        `
        INSERT INTO lease_amendment_signers (
          amendment_id, role, tenant_id, signer_name, signer_email
        )
        VALUES ($1, 'BAILLEUR', NULL, $2, $3)
        `,
        [amendment.id, landlordName, landlordEmail || null],
      );

      for (const tenant of tenantsQ.rows) {
        await client.query(
          `
          INSERT INTO lease_amendment_signers (
            amendment_id, role, tenant_id, signer_name, signer_email
          )
          VALUES ($1, 'LOCATAIRE', $2, $3, $4)
          `,
          [
            amendment.id,
            tenant.id,
            String(tenant.full_name || 'Locataire').trim(),
            String(tenant.email || '').trim() || null,
          ],
        );
      }

      await client.query('COMMIT');

      return amendment;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async generate(leaseId: string, amendmentId: string, opts?: { force?: boolean }) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    if (!amendmentId) throw new BadRequestException('Missing amendmentId');

    const force = !!opts?.force;

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const amendmentQ = await client.query(
        `
        SELECT *
        FROM lease_amendments
        WHERE id = $1
          AND lease_id = $2
        LIMIT 1
        `,
        [amendmentId, leaseId],
      );

      if (!amendmentQ.rowCount) {
        throw new BadRequestException('Unknown amendment');
      }

      const amendment = amendmentQ.rows[0];

      if (amendment.status === 'cancelled') {
        throw new BadRequestException('Cannot generate a cancelled amendment');
      }

      if (amendment.signed_final_document_id) {
        throw new BadRequestException('Cannot regenerate: amendment already signed final');
      }

      if (amendment.document_id && !force) {
        const docQ = await client.query(
          `SELECT * FROM documents WHERE id = $1 LIMIT 1`,
          [amendment.document_id],
        );

        if (docQ.rowCount) {
          await client.query('COMMIT');
          return {
            created: false,
            amendment,
            document: docQ.rows[0],
          };
        }
      }

      if (amendment.document_id && force) {
        const sigQ = await client.query(
          `SELECT 1 FROM signatures WHERE document_id = $1 LIMIT 1`,
          [amendment.document_id],
        );

        if (sigQ.rowCount) {
          throw new BadRequestException('Cannot force regenerate: amendment already has signatures');
        }
      }

      const leaseQ = await client.query(
        `
        SELECT
          l.*,
          u.id AS unit_id,
          u.code AS unit_code,
          u.label AS unit_label,
          u.address_line1,
          u.city,
          u.postal_code,
          COALESCE(pl.name, lp.name, p.name, 'Bailleur') AS landlord_name,
          COALESCE(pl.address, lp.address, '') AS landlord_address,
          COALESCE(pl.email, lp.email, '') AS landlord_email
        FROM leases l
        JOIN units u ON u.id = l.unit_id
        LEFT JOIN projects p ON p.id = u.project_id
        LEFT JOIN project_landlords pl ON pl.id = p.landlord_id
        LEFT JOIN landlord_profiles lp ON lp.id = p.landlord_profile_id
        WHERE l.id = $1
        LIMIT 1
        `,
        [leaseId],
      );

      if (!leaseQ.rowCount) {
        throw new BadRequestException('Unknown leaseId');
      }

      const lease = leaseQ.rows[0];
      const payload = amendment.payload_json || {};

      const currentTenantsQ = await client.query(
        `
        SELECT t.id AS tenant_id, t.full_name
        FROM lease_tenants lt
        JOIN tenants t ON t.id = lt.tenant_id
        WHERE lt.lease_id = $1
        ORDER BY lt.created_at ASC NULLS LAST
        `,
        [leaseId],
      );

      let signersQ = await client.query(
        `
        SELECT *
        FROM lease_amendment_signers
        WHERE amendment_id = $1
        ORDER BY
          CASE
            WHEN role = 'BAILLEUR' THEN 0
            WHEN role = 'LOCATAIRE' THEN 1
            ELSE 2
          END,
          created_at ASC
        `,
        [amendmentId],
      );

      if (!signersQ.rows.some((s: any) => s.role === 'BAILLEUR')) {
        signersQ.rows.unshift({
          role: 'BAILLEUR',
          signer_name: lease.landlord_name || 'Bailleur',
        });
      }

      const tenantIdsToAdd = Array.isArray(payload.tenantIdsToAdd)
        ? payload.tenantIdsToAdd.map((x: any) => String(x || '').trim()).filter(Boolean)
        : [];

      let addedTenants = signersQ.rows.filter(
        (s: any) =>
          s.role === 'LOCATAIRE' &&
          tenantIdsToAdd.includes(String(s.tenant_id || '').trim()),
      );

      const hasTenantSigner = signersQ.rows.some((s: any) => s.role === 'LOCATAIRE');

      if (!hasTenantSigner && tenantIdsToAdd.length) {
        await client.query(
          `
          INSERT INTO lease_amendment_signers (
            amendment_id, role, tenant_id, signer_name, signer_email
          )
          SELECT $1, 'LOCATAIRE', t.id, t.full_name, t.email
          FROM tenants t
          WHERE t.id = ANY($2::uuid[])
            AND NOT EXISTS (
              SELECT 1
              FROM lease_amendment_signers s
              WHERE s.amendment_id = $1
                AND s.role = 'LOCATAIRE'
                AND s.tenant_id = t.id
            )
          `,
          [amendmentId, tenantIdsToAdd],
        );

        signersQ = await client.query(
          `
          SELECT *
          FROM lease_amendment_signers
          WHERE amendment_id = $1
          ORDER BY
            CASE
              WHEN role = 'BAILLEUR' THEN 0
              WHEN role = 'LOCATAIRE' THEN 1
              ELSE 2
            END,
            created_at ASC
          `,
          [amendmentId],
        );
      }

      // Fallback robuste : si payload ancien/incomplet, on prend les signers LOCATAIRE de l’avenant
      if (!addedTenants.length) {
        addedTenants = signersQ.rows.filter((s: any) => s.role === 'LOCATAIRE');
      }

      if (amendment.type !== 'ADD_TENANT') {
        throw new BadRequestException('Unsupported amendment type for PDF generation');
      }

      const currentTenantNames =
        currentTenantsQ.rows
          .filter((r: any) => !tenantIdsToAdd.includes(String(r.tenant_id || '').trim()))
          .map((r: any) => String(r.full_name || '').trim())
          .filter(Boolean);

      const addedTenantNames =
        addedTenants.map((r: any) => String(r.signer_name || '').trim()).filter(Boolean);

      const effectiveDate =
        amendment.effective_date instanceof Date
          ? amendment.effective_date.toISOString().slice(0, 10)
          : String(amendment.effective_date || '').slice(0, 10);

      const filename = `AVENANT_AJOUT_LOCATAIRE_${lease.unit_code || 'LOGEMENT'}_${effectiveDate}.pdf`;

      const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <style>
      body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.5;color:#111}
      h1{font-size:18pt;margin:0 0 16px 0}
      h2{font-size:13pt;margin:18px 0 8px 0}
      .box{border:1px solid #ddd;padding:12px;border-radius:8px;margin-bottom:14px}
      table{border-collapse:collapse;width:100%;margin-top:10px}
      th,td{border:1px solid #ddd;padding:8px;vertical-align:top}
      th{background:#f5f5f5;text-align:left}
      .right{text-align:right}
      .small{color:#555;font-size:10pt;margin-top:16px}
      .signature{height:90px}
      .signature-block{page-break-inside:avoid;break-inside:avoid;margin-top:24px}
      table.signatures{width:100%;border-collapse:collapse;page-break-inside:avoid;break-inside:avoid}
      table.signatures tr{page-break-inside:avoid;break-inside:avoid}
      table.signatures th,table.signatures td{border:1px solid #d0d5dd;padding:10px;vertical-align:top}
    </style>
  </head>
  <body>
    <h1>AVENANT AU CONTRAT DE LOCATION</h1>

    <div class="box">
      <b>Bailleur :</b> ${this.escapeHtml(lease.landlord_name)}<br/>
      <b>Logement :</b> ${this.escapeHtml(lease.unit_label)} (${this.escapeHtml(lease.unit_code)})<br/>
      ${this.escapeHtml(lease.address_line1)}, ${this.escapeHtml(lease.postal_code)} ${this.escapeHtml(lease.city)}<br/>
      <b>Bail initial :</b> signé ou établi pour une prise d’effet au ${this.escapeHtml(this.formatDateFr(lease.start_date))}
    </div>

    <h2>Objet de l’avenant</h2>
    <p>
      Le présent avenant a pour objet l’ajout d’un ou plusieurs locataires au contrat de location
      relatif au logement désigné ci-dessus.
    </p>

    <table>
      <tbody>
        <tr>
          <th>Locataire(s) déjà titulaire(s) du bail</th>
          <td>${this.escapeHtml(currentTenantNames.join(', ') || '—')}</td>
        </tr>
        <tr>
          <th>Nouveau(x) locataire(s) ajouté(s)</th>
          <td>${this.escapeHtml(addedTenantNames.join(', ') || '—')}</td>
        </tr>
        <tr>
          <th>Date d’effet</th>
          <td>${this.escapeHtml(this.formatDateFr(effectiveDate))}</td>
        </tr>
      </tbody>
    </table>

    <h2>Participation complémentaire aux charges</h2>
    <p>
      Conformément aux conditions du bail, l’occupation par une personne supplémentaire entraîne
      une participation complémentaire aux charges.
    </p>

    <table>
      <tbody>
        <tr>
          <th>Charges mensuelles avant avenant</th>
          <td class="right">${this.escapeHtml(this.euros(payload.previousChargesCents))}</td>
        </tr>
        <tr>
          <th>Supplément mensuel par locataire ajouté</th>
          <td class="right">${this.escapeHtml(this.euros(payload.extraChargesCentsPerTenant))}</td>
        </tr>
        <tr>
          <th>Nombre de locataire(s) ajouté(s)</th>
          <td class="right">${addedTenantNames.length}</td>
        </tr>
        <tr>
          <th>Nouveau montant mensuel des charges</th>
          <td class="right"><b>${this.escapeHtml(this.euros(payload.newChargesCents))}</b></td>
        </tr>
      </tbody>
    </table>

    <p>
      À compter du ${this.escapeHtml(this.formatDateFr(effectiveDate))}, le montant mensuel des charges
      est donc porté à <b>${this.escapeHtml(this.euros(payload.newChargesCents))}</b>.
    </p>

    <p>
      Les autres clauses du bail demeurent inchangées. Le nouveau locataire reconnaît avoir pris connaissance
      du bail initial, de ses annexes et des obligations qui en découlent.
    </p>

    <div class="signature-block">
      <h2>Signatures</h2>
      <table class="signatures">
      <thead>
        <tr>
          <th>Partie</th>
          <th>Nom</th>
          <th>Signature</th>
        </tr>
      </thead>
      <tbody>
        ${signersQ.rows
          .map(
            (s: any) => `
            <tr>
              <td>${this.escapeHtml(s.role)}</td>
              <td>${this.escapeHtml(s.signer_name)}</td>
              <td class="signature"></td>
            </tr>
          `,
          )
          .join('')}
      </tbody>
        </table>
</div>

    <p class="small">
      Document généré automatiquement par RentalOS.
    </p>
  </body>
  </html>`;

      const pdfBuf = await this.htmlToPdfBuffer(html);

      const outDir = path.join(
        this.storageBase,
        'units',
        lease.unit_id,
        'leases',
        leaseId,
        'documents',
      );

      this.ensureDir(outDir);

      const absPath = path.join(outDir, filename);
      fs.writeFileSync(absPath, pdfBuf);

      const sha = this.sha256Buffer(pdfBuf);

      if (amendment.document_id && force) {
        await client.query(`DELETE FROM documents WHERE id = $1`, [amendment.document_id]);
      }

      const docIns = await client.query(
        `
        INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
        VALUES ($1, $2, 'AVENANT', $3, $4, $5)
        RETURNING *
        `,
        [
          lease.unit_id,
          leaseId,
          filename,
          absPath.replace(this.storageBase, ''),
          sha,
        ],
      );

      const document = docIns.rows[0];

      const upd = await client.query(
        `
        UPDATE lease_amendments
        SET document_id = $1,
            status = CASE WHEN status = 'draft' THEN 'generated' ELSE status END,
            generated_at = NOW(),
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [document.id, amendmentId],
      );

      await client.query('COMMIT');

      return {
        created: true,
        amendment: upd.rows[0],
        document,
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}