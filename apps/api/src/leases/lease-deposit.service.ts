import { Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class LeaseDepositService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });
  private storageBase = process.env.STORAGE_BASE_PATH || '/storage';
  private gotenberg = process.env.GOTENBERG_URL || 'http://gotenberg:3000';

  private ensureDir(p: string) {
    fs.mkdirSync(p, { recursive: true });
  }

  private sha256Buffer(buf: Buffer) {
    return crypto.createHash('sha256').update(buf).digest('hex');
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
        `Deposit summary PDF generation failed: ${await resp.text()}`,
      );
    }

    return Buffer.from(await resp.arrayBuffer());
}

  async list(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const r = await this.pool.query(
      `SELECT * FROM lease_deposit_deductions WHERE lease_id=$1 ORDER BY created_at DESC`,
      [leaseId]
    );

    return r.rows;
  }

  async create(body: any) {
    const { leaseId, label, amountCents } = body || {};

    if (!leaseId) throw new BadRequestException('Missing leaseId');
    if (!label) throw new BadRequestException('Missing label');

    const amount = Number(amountCents);
    if (!Number.isInteger(amount) || amount < 0) {
      throw new BadRequestException('Invalid amountCents');
    }

    const r = await this.pool.query(
      `
      INSERT INTO lease_deposit_deductions (
        lease_id,
        label,
        amount_cents
      )
      VALUES ($1,$2,$3)
      RETURNING *
      `,
      [leaseId, label, amount]
    );

    return r.rows[0];
  }

  async remove(id: string) {
    const r = await this.pool.query(
      `DELETE FROM lease_deposit_deductions WHERE id=$1 RETURNING *`,
      [id]
    );

    if (!r.rowCount) {
      throw new BadRequestException('Unknown id');
    }

    return { ok: true };
  }

  async generateSummary(body: any) {
    const { leaseId } = body || {};
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const leaseRes = await this.pool.query(
      `
      SELECT
        l.*,
        u.id AS unit_id,
        u.code AS unit_code,
        u.label AS unit_label,
        u.address_line1,
        u.city,
        u.postal_code,
        COALESCE(pl.name, lp.name, p.name) AS landlord_name,
        COALESCE(pl.address, lp.address) AS landlord_address,
        t.full_name AS tenant_name
      FROM leases l
      JOIN units u ON u.id = l.unit_id
      LEFT JOIN projects p ON p.id = u.project_id
      LEFT JOIN project_landlords pl ON pl.id = p.landlord_id
      LEFT JOIN landlord_profiles lp ON lp.id = p.landlord_profile_id
      JOIN tenants t ON t.id = l.tenant_id
      WHERE l.id = $1
      LIMIT 1
      `,
      [leaseId],
    );

    if (!leaseRes.rowCount) {
      throw new BadRequestException('Unknown leaseId');
    }

    const lease = leaseRes.rows[0];

    const deductionsRes = await this.pool.query(
      `
      SELECT *
      FROM lease_deposit_deductions
      WHERE lease_id = $1
      ORDER BY created_at ASC
      `,
      [leaseId],
    );

    const deductions = deductionsRes.rows;

    const depositCents = Number(lease.deposit_cents || 0);
    const totalDeductionsCents = deductions.reduce(
      (sum: number, d: any) => sum + Number(d.amount_cents || 0),
      0,
    );
    const restitutionCents = Math.max(0, depositCents - totalDeductionsCents);

    const fmt = (cents: number) => `${(Number(cents || 0) / 100).toFixed(2)} €`;
    const escapeHtml = (s: any) =>
      String(s ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

    const issueDate = new Date().toLocaleDateString('fr-FR');
    const exitDate = lease.actual_exit_date
      ? new Date(lease.actual_exit_date).toLocaleDateString('fr-FR')
      : lease.planned_exit_date
        ? new Date(lease.planned_exit_date).toLocaleDateString('fr-FR')
        : '—';

    const deductionsRows = deductions.length
      ? deductions
          .map(
            (d: any) => `
            <tr>
              <td>${escapeHtml(d.label)}</td>
              <td class="right">${fmt(d.amount_cents)}</td>
            </tr>
          `,
          )
          .join('')
      : `
        <tr>
          <td>Aucune retenue</td>
          <td class="right">0.00 €</td>
        </tr>
      `;

    const html = `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <style>
        body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.5;color:#111}
        h1{font-size:18pt;margin:0 0 16px 0}
        .box{border:1px solid #ddd;padding:12px;border-radius:8px;margin-bottom:16px}
        .section{margin-bottom:14px}
        table{border-collapse:collapse;width:100%;margin-top:10px}
        th,td{border:1px solid #ddd;padding:8px}
        th{background:#f5f5f5}
        .right{text-align:right}
        .total{font-weight:bold;background:#fafafa}
        .small{color:#666;font-size:10pt;margin-top:16px}
      </style>
    </head>
    <body>
      <h1>SOLDE DE SORTIE — DÉPÔT DE GARANTIE</h1>

      <div class="box">
        <b>Bailleur :</b> ${escapeHtml(lease.landlord_name || process.env.COMPANY_NAME || 'Bailleur')}<br/>
        <b>Locataire :</b> ${escapeHtml(lease.tenant_name)}<br/>
        <b>Logement :</b> ${escapeHtml(lease.unit_label)} (${escapeHtml(lease.unit_code)})<br/>
        ${escapeHtml(lease.address_line1)}, ${escapeHtml(lease.postal_code)} ${escapeHtml(lease.city)}<br/>
        <b>Date de sortie :</b> ${escapeHtml(exitDate)}
      </div>

      <div class="section">
        Le présent document récapitule le dépôt de garantie versé, les retenues appliquées
        et le montant restant à restituer au locataire.
      </div>

      <table>
        <thead>
          <tr>
            <th>Détail</th>
            <th class="right">Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Dépôt de garantie versé</td>
            <td class="right">${fmt(depositCents)}</td>
          </tr>
          ${deductionsRows}
          <tr class="total">
            <td>Total retenues</td>
            <td class="right">${fmt(totalDeductionsCents)}</td>
          </tr>
          <tr class="total">
            <td>Montant à restituer</td>
            <td class="right">${fmt(restitutionCents)}</td>
          </tr>
        </tbody>
      </table>

      <div class="section">
        Fait le ${issueDate}
      </div>

      <p class="small">
        Document généré automatiquement par RentalOS.
      </p>
    </body>
    </html>`;

    const pdfBuf = await this.htmlToPdfBuffer(html);

    const filename = `SOLDE_SORTIE_${lease.unit_code || 'LOGEMENT'}_${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`;

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

    const docIns = await this.pool.query(
      `
      INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
      VALUES ($1,$2,'ANNEXE',$3,$4,$5)
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

    return {
      ok: true,
      document: docIns.rows[0],
      depositCents,
      totalDeductionsCents,
      restitutionCents,
    };
  }
}