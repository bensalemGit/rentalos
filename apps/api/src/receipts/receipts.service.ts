import { Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { MailerService } from '../mailer/mailer.service';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function escapeHtml(s: any) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

@Injectable()
export class ReceiptsService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });
  private storageBase = process.env.STORAGE_BASE_PATH || '/storage';
  private gotenberg = process.env.GOTENBERG_URL || 'http://gotenberg:3000';

  constructor(private readonly mailer: MailerService) {}

  private ensureDir(p: string) {
    fs.mkdirSync(p, { recursive: true });
  }

  private sha256Buffer(buf: Buffer) {
    return crypto.createHash('sha256').update(buf).digest('hex');
  }

  private async htmlToPdfBuffer(html: string): Promise<Buffer> {
    const form = new FormData();
    form.append('files', new Blob([new Uint8Array(Buffer.from(html, 'utf-8'))], { type: 'text/html' }), 'index.html');

    const resp = await fetch(`${this.gotenberg}/forms/chromium/convert/html`, { method: 'POST', body: form as any });
    if (!resp.ok) throw new BadRequestException(`Receipt PDF generation failed: ${await resp.text()}`);
    return Buffer.from(await resp.arrayBuffer());
  }

  private async getLeaseBundle(leaseId: string) {
    const q = await this.pool.query(
      `SELECT l.*, u.id as unit_id, u.code as unit_code, u.label as unit_label, u.address_line1, u.city, u.postal_code,
              t.full_name as tenant_name, t.email as tenant_email
       FROM leases l
       JOIN units u ON u.id = l.unit_id
       JOIN tenants t ON t.id = l.tenant_id
       WHERE l.id=$1`,
      [leaseId]
    );
    if (!q.rowCount) throw new BadRequestException('Unknown leaseId');
    return q.rows[0];
  }

  async generate(body: any) {
    const { leaseId, year, month } = body || {};
    if (!leaseId || !year || !month) throw new BadRequestException('Missing leaseId/year/month');

    const y = Number(year);
    const m = Number(month);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      throw new BadRequestException('Invalid year/month');
    }

    // If receipt exists, return it
    const existing = await this.pool.query(
      `SELECT * FROM receipts WHERE lease_id=$1 AND period_year=$2 AND period_month=$3`,
      [leaseId, y, m]
    );
    if (existing.rowCount && existing.rows[0].document_id) {
      const doc = await this.pool.query(`SELECT * FROM documents WHERE id=$1`, [existing.rows[0].document_id]);
      if (doc.rowCount) return { receipt: existing.rows[0], document: doc.rows[0], reused: true };
    }

    const lease = await this.getLeaseBundle(leaseId);

    const rentCents = Number(lease.rent_cents || 0);
    const chargesCents = Number(lease.charges_cents || 0);

    // Create/Upsert receipt record
    const up = await this.pool.query(
      `INSERT INTO receipts (lease_id, period_year, period_month, total_rent_cents, total_charges_cents)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (lease_id, period_year, period_month)
       DO UPDATE SET total_rent_cents=$4, total_charges_cents=$5
       RETURNING *`,
      [leaseId, y, m, rentCents, chargesCents]
    );
    const receipt = up.rows[0];

    const monthLabel = `${pad2(m)}/${y}`;
    const total = (rentCents + chargesCents) / 100;

    const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.35}
h1{font-size:16pt;margin:0 0 10px 0}
.box{border:1px solid #ddd;padding:10px;margin:10px 0;border-radius:8px}
.small{color:#666;font-size:10pt}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ddd;padding:8px;vertical-align:top}
th{background:#f5f5f5}
.right{text-align:right}
</style></head>
<body>
<h1>Quittance de loyer — ${escapeHtml(monthLabel)}</h1>

<div class="box">
<b>Bail :</b> ${escapeHtml(leaseId)}<br/>
<b>Locataire :</b> ${escapeHtml(lease.tenant_name)}<br/>
<b>Logement :</b> ${escapeHtml(lease.unit_label)} (${escapeHtml(lease.unit_code)})<br/>
${escapeHtml(lease.address_line1)}, ${escapeHtml(lease.postal_code)} ${escapeHtml(lease.city)}
</div>

<table>
  <thead>
    <tr>
      <th>Désignation</th>
      <th class="right">Montant</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Loyer (hors charges)</td>
      <td class="right">${(rentCents/100).toFixed(2)} €</td>
    </tr>
    <tr>
      <td>Charges</td>
      <td class="right">${(chargesCents/100).toFixed(2)} €</td>
    </tr>
    <tr>
      <th>Total</th>
      <th class="right">${total.toFixed(2)} €</th>
    </tr>
  </tbody>
</table>

<p class="small">Quittance générée automatiquement par RentalOS (Option 1 : basée sur le montant du bail).</p>
</body></html>`;

    const pdfBuf = await this.htmlToPdfBuffer(html);

    const filename = `QUITTANCE_${lease.unit_code}_${monthLabel.replace('/','-')}.pdf`;
    const outDir = path.join(this.storageBase, 'units', lease.unit_id, 'leases', leaseId, 'documents');
    this.ensureDir(outDir);
    const absPath = path.join(outDir, filename);
    fs.writeFileSync(absPath, pdfBuf);

    const sha = this.sha256Buffer(pdfBuf);

    // Store as documents(type='ANNEXE') to avoid changing enum
    const docIns = await this.pool.query(
      `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
       VALUES ($1,$2,'ANNEXE',$3,$4,$5) RETURNING *`,
      [lease.unit_id, leaseId, filename, absPath.replace(this.storageBase, ''), sha]
    );
    const document = docIns.rows[0];

    // Link receipt -> document
    await this.pool.query(
      `UPDATE receipts SET document_id=$1 WHERE id=$2`,
      [document.id, receipt.id]
    );

    return { receipt, document, reused: false };
  }

  async send(body: any) {
    const { leaseId, year, month, emailOverride } = body || {};
    if (!leaseId || !year || !month) throw new BadRequestException('Missing leaseId/year/month');

    const g = await this.generate({ leaseId, year, month });
    const lease = await this.getLeaseBundle(leaseId);

    const toEmail = (emailOverride && String(emailOverride).includes('@'))
      ? String(emailOverride).trim()
      : lease.tenant_email;

    if (!toEmail) throw new BadRequestException('Tenant has no email (or set emailOverride)');

    const absPath = path.join(this.storageBase, g.document.storage_path);
    const buf = fs.readFileSync(absPath);

    const subject = `Quittance de loyer — ${pad2(Number(month))}/${Number(year)} — ${lease.unit_code}`;
    const html = `
      <p>Bonjour ${lease.tenant_name || ''},</p>
      <p>Veuillez trouver ci-joint votre quittance de loyer pour <b>${pad2(Number(month))}/${Number(year)}</b> (logement <b>${lease.unit_code}</b>).</p>
      <p>Bien cordialement,<br/>RentalOS</p>
    `;

    const sendRes = await this.mailer.sendMail(toEmail, subject, html, [
      { filename: g.document.filename, content: buf, contentType: 'application/pdf' }
    ]);

    if (!sendRes.sent) {
      return { ok: false, sent: false, error: sendRes.error, leaseId, toEmail, documentId: g.document.id };
    }

    await this.pool.query(
      `UPDATE receipts SET sent_to=$1, sent_at=now() WHERE id=$2`,
      [toEmail, g.receipt.id]
    );

    return { ok: true, sent: true, toEmail, receipt: g.receipt, document: g.document };
  }
}
