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
        `Receipt PDF generation failed: ${await resp.text()}`,
      );
    }

    return Buffer.from(await resp.arrayBuffer());
  }

  private async getLeaseBundle(
    leaseId: string,
    periodYear?: number,
    periodMonth?: number,
  ) {
    const q = await this.pool.query(
            `
      SELECT
        l.*,
        COALESCE(a.rent_cents, l.rent_cents) AS rent_cents,
        COALESCE(a.charges_cents, l.charges_cents) AS charges_cents,

        u.id AS unit_id,
        u.code AS unit_code,
        u.label AS unit_label,
        u.address_line1,
        u.city,
        u.postal_code,

        p.id AS project_id,
        p.name AS project_name,

        COALESCE(pl.name, lp.name, p.name) AS landlord_name,
        COALESCE(pl.address, lp.address) AS landlord_address,
        COALESCE(pl.email, lp.email) AS landlord_email,
        COALESCE(pl.phone, lp.phone) AS landlord_phone,
        COALESCE(pl.city, '') AS landlord_city,
        COALESCE(pl.postal_code, '') AS landlord_postal_code,
        lp.representative AS landlord_representative,

        t.full_name AS primary_tenant_name,
        t.email AS tenant_email,

        COALESCE(NULLIF(ltg.tenant_names, ''), t.full_name) AS tenant_name,
        COALESCE(ltg.tenant_count, 1) AS tenant_count

      FROM leases l
      JOIN units u ON u.id = l.unit_id
      LEFT JOIN projects p ON p.id = u.project_id
      LEFT JOIN project_landlords pl ON pl.id = p.landlord_id
      LEFT JOIN landlord_profiles lp ON lp.id = p.landlord_profile_id

      LEFT JOIN LATERAL (
        SELECT
          string_agg(t2.full_name, ', ' ORDER BY t2.full_name) AS tenant_names,
          COUNT(*)::int AS tenant_count
        FROM lease_tenants lt
        JOIN tenants t2 ON t2.id = lt.tenant_id
        WHERE lt.lease_id = l.id
      ) ltg ON TRUE

      JOIN tenants t ON t.id = l.tenant_id

      LEFT JOIN LATERAL (
        SELECT rent_cents, charges_cents, deposit_cents, payment_day
        FROM lease_amounts
        WHERE lease_id = l.id
          AND effective_date <= COALESCE(make_date($2::int, $3::int, 1), CURRENT_DATE)
        ORDER BY effective_date DESC
        LIMIT 1
      ) a ON TRUE

      WHERE l.id = $1
      LIMIT 1
      `,
      [leaseId, periodYear ?? null, periodMonth ?? null],
    );

    if (!q.rowCount) throw new BadRequestException('Unknown leaseId');
    return q.rows[0];
  }

  async list(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const q = await this.pool.query(
      `
      SELECT
        r.*,
        d.filename,
        d.storage_path,
        d.created_at AS document_created_at
      FROM receipts r
      LEFT JOIN documents d ON d.id = r.document_id
      WHERE r.lease_id = $1
      ORDER BY r.period_year DESC, r.period_month DESC
      `,
      [leaseId],
    );

    return q.rows;
  }

  async generate(body: any) {
    const { leaseId, year, month, force } = body || {};
    if (!leaseId || !year || !month) {
      throw new BadRequestException('Missing leaseId/year/month');
    }

    const y = Number(year);
    const m = Number(month);

    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      throw new BadRequestException('Invalid year/month');
    }

    const existing = await this.pool.query(
      `SELECT * FROM receipts WHERE lease_id=$1 AND period_year=$2 AND period_month=$3`,
      [leaseId, y, m],
    );

    if (!force && existing.rowCount && existing.rows[0].document_id) {
      const doc = await this.pool.query(`SELECT * FROM documents WHERE id=$1`, [
        existing.rows[0].document_id,
      ]);

      if (doc.rowCount) {
        return {
          receipt: existing.rows[0],
          document: doc.rows[0],
          reused: true,
        };
      }
    }

    const lease = await this.getLeaseBundle(leaseId, y, m);

    const rentCents = Number(lease.rent_cents || 0);
    const chargesCents = Number(lease.charges_cents || 0);

    // === PRORATA ===
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 0);
    const daysInMonth = monthEnd.getDate();

    const leaseStartDate = lease.start_date
      ? new Date(lease.start_date)
      : monthStart;

    const leaseEndDate = lease.actual_exit_date
      ? new Date(lease.actual_exit_date)
      : lease.end_date_theoretical
        ? new Date(lease.end_date_theoretical)
        : monthEnd;

    const effectivePeriodStart =
      leaseStartDate > monthStart ? leaseStartDate : monthStart;

    const effectivePeriodEnd =
      leaseEndDate < monthEnd ? leaseEndDate : monthEnd;

    const occupiedDays =
      effectivePeriodEnd >= effectivePeriodStart
        ? effectivePeriodEnd.getDate() - effectivePeriodStart.getDate() + 1
        : 0;

    if (occupiedDays <= 0) {
      throw new BadRequestException("Aucune occupation sur cette période de quittance");
    }

    const prorataFactor = occupiedDays / daysInMonth;

    const dueRentCents = Math.round(rentCents * prorataFactor);
    const dueChargesCents = Math.round(chargesCents * prorataFactor);
    const dueTotalCents = dueRentCents + dueChargesCents;

    const paymentsRes = await this.pool.query(
      `
      SELECT
        COALESCE(SUM(amount_cents), 0)::int AS paid_cents,
        MAX(paid_at) AS last_paid_at
      FROM payments
      WHERE lease_id = $1
        AND period_year = $2
        AND period_month = $3
      `,
      [leaseId, y, m],
    );
    const paidCents = Number(paymentsRes.rows[0]?.paid_cents || 0);

    if (paidCents <= 0) {
      throw new BadRequestException("Aucun paiement reçu pour cette période");
    }

    if (paidCents > dueTotalCents) {
      throw new BadRequestException("Paiement supérieur au montant dû pour cette période");
    }

    const isPartialPayment = paidCents < dueTotalCents;
    const receiptRentCents = isPartialPayment
      ? Math.round(paidCents * (dueRentCents / dueTotalCents))
      : dueRentCents;

    const receiptChargesCents = isPartialPayment
      ? paidCents - receiptRentCents
      : dueChargesCents;

    const isProrated = prorataFactor !== 1;

    const up = await this.pool.query(
      `
      INSERT INTO receipts (
        lease_id,
        period_year,
        period_month,
        total_rent_cents,
        total_charges_cents
      )
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (lease_id, period_year, period_month)
      DO UPDATE SET
        total_rent_cents=$4,
        total_charges_cents=$5
      RETURNING *
      `,
      [leaseId, y, m, receiptRentCents, receiptChargesCents],
    );

    const receipt = up.rows[0];

    const monthLabel = `${pad2(m)}/${y}`;
    const total = (receiptRentCents + receiptChargesCents) / 100;

    const periodStart = effectivePeriodStart.toLocaleDateString("fr-FR");
    const periodEndStr = effectivePeriodEnd.toLocaleDateString("fr-FR");
    const issueDate = new Date().toLocaleDateString("fr-FR");
    const paymentReceivedDate = paymentsRes.rows[0]?.last_paid_at
      ? new Date(paymentsRes.rows[0].last_paid_at).toLocaleDateString("fr-FR")
      : issueDate;

    const html = `<!doctype html>
    <html>
    <head>
    <meta charset="utf-8"/>
    <style>
    body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.5}
    h1{font-size:18pt;margin:0 0 16px 0}
    .section{margin-bottom:12px}
    .box{border:1px solid #ddd;padding:12px;border-radius:8px;margin-bottom:16px}
    table{border-collapse:collapse;width:100%;margin-top:10px}
    th,td{border:1px solid #ddd;padding:8px}
    th{background:#f5f5f5}
    .right{text-align:right}
    .small{color:#666;font-size:10pt;margin-top:16px}
    </style>
    </head>
    <body>

    <h1>${isPartialPayment ? "REÇU DE PAIEMENT PARTIEL" : "QUITTANCE DE LOYER"}</h1>

    <div class="box">
    <b>Bailleur :</b> ${escapeHtml(lease.landlord_name || process.env.COMPANY_NAME || "Bailleur")}<br/>
    <b>Locataire :</b> ${escapeHtml(lease.tenant_name)}<br/>
    <b>Logement :</b> ${escapeHtml(lease.unit_label)} (${escapeHtml(lease.unit_code)})<br/>
    ${escapeHtml(lease.address_line1)}, ${escapeHtml(lease.postal_code)} ${escapeHtml(lease.city)}
    </div>

    <div class="section">
    Je soussigné(e) <b>${escapeHtml(lease.landlord_name || process.env.COMPANY_NAME || "Bailleur")}</b>, bailleur du logement désigné ci-dessus, reconnais avoir reçu de 
    <b>${escapeHtml(lease.tenant_name)}</b> la somme de <b>${total.toFixed(2)} €</b>,
    au titre du paiement du loyer et des charges pour la période du 
    <b>${periodStart}</b> au <b>${periodEndStr}</b>.
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
          <td>Loyer hors charges</td>
          <td class="right">${(receiptRentCents/100).toFixed(2)} €</td>
        </tr>
        <tr>
          <td>Charges</td>
          <td class="right">${(receiptChargesCents/100).toFixed(2)} €</td>
        </tr>
        <tr>
          <th>Total</th>
          <th class="right">${total.toFixed(2)} €</th>
        </tr>
      </tbody>
    </table>

    ${isProrated ? `
      <div class="small">
      Montant calculé au prorata temporis pour ${occupiedDays} jour(s) d’occupation sur ${daysInMonth}.
      </div>
      ` : ""}

    <div class="section">
    Paiement reçu le ${paymentReceivedDate}.
    </div>

    <div class="section">
    ${isPartialPayment
      ? `Paiement partiel reçu : ${(paidCents / 100).toFixed(2)} € sur ${(dueTotalCents / 100).toFixed(2)} € dus pour cette période. Ce document ne vaut pas quittance complète.`
      : "Le locataire est quitte du paiement du loyer et des charges pour cette période."
    }
    </div>

    <div class="section">
    Fait le ${issueDate}
    </div>

    <p class="small">
    Quittance conforme à l’article 21 de la loi du 6 juillet 1989. Document généré automatiquement par RentalOS.
    </p>

    </body>
    </html>`;

    const pdfBuf = await this.htmlToPdfBuffer(html);

    const filename = `${isPartialPayment ? "RECU_PARTIEL" : "QUITTANCE"}_${lease.unit_code}_${monthLabel.replace('/', '-')}.pdf`;
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

    const document = docIns.rows[0];

    await this.pool.query(`UPDATE receipts SET document_id=$1 WHERE id=$2`, [
      document.id,
      receipt.id,
    ]);

    return {
      receipt: {
        ...receipt,
        document_id: document.id,
      },
      document,
      reused: false,
    };
  }

  async send(body: any) {
    const { leaseId, year, month, emailOverride } = body || {};

    if (!leaseId || !year || !month) {
      throw new BadRequestException('Missing leaseId/year/month');
    }

    const g = await this.generate({ leaseId, year, month, force: true });
    const lease = await this.getLeaseBundle(leaseId, Number(year), Number(month));

    const toEmail =
      emailOverride && String(emailOverride).includes('@')
        ? String(emailOverride).trim()
        : lease.tenant_email;

    if (!toEmail) {
      throw new BadRequestException('Tenant has no email (or set emailOverride)');
    }

    const absPath = path.join(this.storageBase, g.document.storage_path);
    const buf = fs.readFileSync(absPath);

    const subject = `Quittance de loyer — ${pad2(Number(month))}/${Number(year)} — ${lease.unit_code}`;
    const html = `
      <p>Bonjour ${escapeHtml(lease.tenant_name || '')},</p>
      <p>Veuillez trouver ci-joint votre quittance de loyer pour <b>${pad2(Number(month))}/${Number(year)}</b> (logement <b>${escapeHtml(lease.unit_code)}</b>).</p>
      <p>Bien cordialement,<br/>RentalOS</p>
    `;

    const sendRes = await this.mailer.sendMail(toEmail, subject, html, [
      {
        filename: g.document.filename,
        content: buf,
        contentType: 'application/pdf',
      },
    ]);

    if (!sendRes.sent) {
      return {
        ok: false,
        sent: false,
        error: sendRes.error,
        leaseId,
        toEmail,
        documentId: g.document.id,
      };
    }

    return {
      ok: true,
      sent: true,
      leaseId,
      toEmail,
      documentId: g.document.id,
      receiptId: g.receipt.id,
      reused: g.reused,
    };
  }
}