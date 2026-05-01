import { Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as fsSync from 'fs';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';

type SignRole = 'BAILLEUR' | 'LOCATAIRE' | 'GARANT';
type LeaseKind = 'MEUBLE_RP' | 'NU_RP' | 'SAISONNIER';
type DocType =
  | 'CONTRAT'
  | 'EDL'
  | 'INVENTAIRE'
  | 'ANNEXE'
  | 'PHOTO'
  | 'NOTICE'
  | 'PACK'
  | 'PACK_FINAL'
  | 'GUARANTOR_ACT'
  | 'AVENANT_IRL'
  | 'EDL_ENTREE'
  | 'EDL_SORTIE'
  | 'INVENTAIRE_ENTREE'
  | 'INVENTAIRE_SORTIE'
  | 'PACK_EDL_INV_ENTREE'
  | 'PACK_EDL_INV_SORTIE'
  | 'ATTESTATION_SORTIE';

type TemplateRow = {
  id: string;
  kind: string;
  lease_kind: LeaseKind;
  version: string;
  title: string;
  html_template: string;
};

type AnyRow = any;

@Injectable()
export class DocumentsService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });
  private storageBase = process.env.STORAGE_BASE_PATH || '/storage';
  private gotenberg = process.env.GOTENBERG_URL || 'http://gotenberg:3000';

  // -------------------------------------
  // Helpers
  // -------------------------------------
  private ensureDir(p: string) {
    fsSync.mkdirSync(p, { recursive: true });
  }

  private absFromStoragePath(storagePath: any): string {
    const raw = String(storagePath || '').trim();
    if (!raw) return '';

    if (raw === this.storageBase || raw.startsWith(this.storageBase + path.sep)) {
      return raw;
    }

    const rel = raw.replace(/^\/+/, '');
    return path.join(this.storageBase, rel);
  }

// -------------------------------------
// UUID guard (anti "sessions" en uuid)
// -------------------------------------
private isUuidV4(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ''));
}

private assertUuidV4(id: string, label: string) {
  if (!this.isUuidV4(id)) {
    throw new BadRequestException(`Invalid ${label} (expected uuid v4)`);
  }
}

// -------------------------------------
// Session selector by phase
// -------------------------------------
private async getLatestSessionByPhase(args: {
  leaseId: string;
  table: 'inventory_sessions' | 'edl_sessions';
  phase: 'entry' | 'exit';
}) {
  const { leaseId, table, phase } = args;

  // IMPORTANT: phase == status dans ton modèle actuel
  const q = await this.pool.query(
    `SELECT * FROM ${table} WHERE lease_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT 1`,
    [leaseId, phase],
  );

  return q.rowCount ? q.rows[0] : null;
}

    /**
   * Idempotence helper:
   * - returns an existing document row (same lease/type/filename) if present and file exists.
   * - Conservative: only used for "stable" docs (contract/notice/act/pack).
   */
  private async findExistingDocByFilename(args: {
    leaseId: string;
    type: DocType;
    filename: string;
    parentNullOnly?: boolean;
  }): Promise<any | null> {
    const { leaseId, type, filename, parentNullOnly } = args;
    const cleanFilename = String(filename || '').trim();
    const r = await this.pool.query(
      `
      SELECT *
      FROM documents
      WHERE lease_id=$1
        AND type=$2
        AND filename=$3
        ${parentNullOnly ? 'AND parent_document_id IS NULL' : ''}
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId, type, cleanFilename],
    );

    if (!r.rowCount) return null;
    const doc = r.rows[0];

    // ⚠️ storage_path est souvent stocké avec un "/" initial (ex: "/units/...").
    // path.join('/storage', '/units/...') ignorerait '/storage', donc on normalise.
    const absPath = this.absFromStoragePath(doc.storage_path);
    if (!fsSync.existsSync(absPath)) return null;
    return doc;
  }

  private async safeUnlinkAbs(absPath: string) {
    try {
      await fs.unlink(absPath);
    } catch (e: any) {
      if (e?.code !== 'ENOENT') {
        console.warn('[FORCE REBUILD] unlink failed', { absPath, error: String(e?.message || e) });
      }
    }
  }

  private async deleteDocumentRow(id: string) {
    await this.pool.query(`DELETE FROM documents WHERE id=$1`, [id]);
  }


  // helper compatible with previous snippets
  private sha256(bytes: Uint8Array | Buffer): string {
    const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    return this.sha256Buffer(buf);
  }

  private sha256Buffer(buf: Buffer) {
    return crypto.createHash('sha256').update(buf).digest('hex');
  }

  private sha256File(absPath: string) {
    const buf = fsSync.readFileSync(absPath);
    return this.sha256Buffer(buf);
  }

  private fileToDataUrlPng(absPath: string) {
    const b = fsSync.readFileSync(absPath);
    return `data:image/png;base64,${b.toString('base64')}`;
  }

  private isoDate(d: any): string {
    if (!d) return '';

    // Date object
    if (d instanceof Date) {
      // -> YYYY-MM-DD
      return d.toISOString().slice(0, 10);
    }

    // numeric timestamp
    if (typeof d === 'number') {
      return new Date(d).toISOString().slice(0, 10);
    }

    const s = String(d).trim();

    // already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // starts with YYYY-MM-DD (ex: 2026-02-21T00:00:00.000Z)
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];

    // last resort: try Date parse
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);

    return '';
  }

  private formatDateFr(d: any): string {
    if (!d) return '';
    const iso = this.isoDate(d);
    if (!iso) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [yyyy, mm, dd] = iso.split('-');
      return `${dd}/${mm}/${yyyy}`;
    }
    return iso;
  }

  private toEuros(cents: any): string {
    const n = Number(cents ?? 0);
    return (n / 100).toFixed(2);
  }

  private async getAmountsAsOf(
    client: any,
    leaseId: string,
    asOfDate: string,
  ) {
    const r = await client.query(
      `SELECT rent_cents, charges_cents, deposit_cents, payment_day
      FROM lease_amounts
      WHERE lease_id=$1 AND effective_date <= $2::date
      ORDER BY effective_date DESC
      LIMIT 1`,
      [leaseId, asOfDate],
    );
    if (!r.rowCount) return null;
    return r.rows[0];
  }

  private escapeHtml(s: any) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  private leaseIdShort(id: string) {
    return String(id || '').slice(0, 8);
  }

  private parseJsonSafe(v: any): any {
    if (v == null) return null;
    if (typeof v === 'object') return v;
    const s = String(v || '').trim();
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }

  private normalizeText(v: any): string {
    const s = String(v ?? '').trim();
    return s;
  }

  private missingSpan(label = 'À compléter'): string {
    // Inline style so we don't depend on template CSS
    return `<span style="color:#b00020;font-weight:700">${this.escapeHtml(label)}</span>`;
  }



  // -------------------------------------
  // Templates
  // -------------------------------------
  private async getTemplate(kind: string, leaseKind: LeaseKind, version = '2026-04'): Promise<TemplateRow> {
    console.warn("[TPL VERSION USED]", { kind, leaseKind, version });
    const r = await this.pool.query(
      `SELECT * FROM document_templates
       WHERE kind=$1 AND lease_kind=$2 AND version=$3
       LIMIT 1`,
      [kind, leaseKind, version],
    );
    if (!r.rowCount) throw new BadRequestException(`Missing template: ${kind}/${leaseKind}/${version}`);
    return r.rows[0];
  }

  private applyVars(html: string, vars: Record<string, any>) {
    let out = html;
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{{${k}}}`, String(v ?? ''));
    }
    return out;
  }

  private async htmlToPdfBuffer(html: string): Promise<Buffer> {
    // 1) sécurité meta
    if (!/<meta\s+charset=/i.test(html)) {
      html = html.replace(/<head>/i, '<head><meta charset="utf-8">');
    }
    if (!/http-equiv=["']Content-Type["']/i.test(html)) {
      html = html.replace(
        /<head>/i,
        '<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8" />'
      );
    }

    // 2) IMPORTANT: Buffer UTF-8 strict (sans ambiguïté)
    // (BOM optionnel: je préfère sans BOM en prod pour éviter toute bizarrerie)
    const htmlBuf = Buffer.from(html, 'utf8');

    // 3) form-data (node) + contentType explicite
    const form = new FormData();
    const htmlFile = new File([new Uint8Array(htmlBuf)], 'index.html', {
      type: 'text/html; charset=utf-8',
    });

    form.append('files', htmlFile);

    // debug optionnel
    if (process.env.DEBUG_CONTRACT_HTML === '1') {
      fsSync.writeFileSync('/tmp/contract_debug.html', html, { encoding: 'utf8' });
      fsSync.writeFileSync('/tmp/contract_debug.bytes', htmlBuf); // pour vérifier les bytes
    }

    console.log("First 50 chars:", html.slice(0, 50));
    const resp = await fetch(`${this.gotenberg}/forms/chromium/convert/html`, {
      method: 'POST',
      body: form
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`PDF generation failed: ${resp.status} ${txt}`);
    }

    return Buffer.from(await resp.arrayBuffer());
  }

  private isProbablyPdf(buf: Buffer): boolean {
  if (!buf || buf.length < 5) return false;
  // "%PDF-" signature
  return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2d;
  }

  private summarizeParts(parts: Array<{ filename: string; buffer: Buffer }>) {
    return parts.map(p => ({
      filename: p.filename,
      bytes: p.buffer?.length ?? 0,
      pdfHeaderOk: this.isProbablyPdf(p.buffer),
    }));
  }

  private summarizeDocsForDebug(docs: any[]) {
    return (docs || []).map((d: any) => ({
      id: d?.id || null,
      type: d?.type || null,
      filename: d?.filename || null,
      parent_document_id: d?.parent_document_id || null,
      signed_final_document_id: d?.signed_final_document_id || null,
    }));
  }

  // -------------------------------------
  // PDF merge helpers (PACK_FINAL)
  // -------------------------------------
  private async mergePdfsGotenberg(
    pdfs: Array<{ filename: string; buffer: Buffer }>
  ): Promise<Buffer> {
    if (!pdfs || pdfs.length === 0) {
      throw new BadRequestException('PDF merge failed: empty parts list');
    }

    // ✅ mini validation (très utile quand un buffer est vide/cassé)
    const bad = pdfs.filter(p => !p?.buffer || p.buffer.length === 0 || !this.isProbablyPdf(p.buffer));
    if (bad.length) {
      throw new BadRequestException({
        message: 'PDF merge failed: invalid PDF buffer(s)',
        bad: bad.map(b => ({ filename: b.filename, bytes: b.buffer?.length ?? 0 })),
        all: this.summarizeParts(pdfs),
      } as any);
    }

    const form = new FormData();

    for (const p of pdfs) {
      const pdfFile = new File([new Uint8Array(p.buffer)], p.filename, {
        type: 'application/pdf',
      });
      form.append('files', pdfFile);
    }

    let resp: Response;
    try {
      resp = await fetch(`${this.gotenberg}/forms/pdfengines/merge`, {
        method: 'POST',
        body: form,
        // ⚠️ NE PAS mettre headers !!!
      });
    } catch (e: any) {
      // ⚠️ Erreur réseau / gotenberg down
      throw new BadRequestException({
        message: 'PDF merge failed: gotenberg unreachable',
        error: String(e?.message || e),
        parts: this.summarizeParts(pdfs),
      } as any);
    }

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      // ✅ message exploitable + liste des fichiers
      throw new BadRequestException({
        message: `PDF merge failed: gotenberg ${resp.status}`,
        gotenbergBody: (txt || '').slice(0, 4000), // éviter log infini
        parts: this.summarizeParts(pdfs),
      } as any);
    }

    const out = Buffer.from(await resp.arrayBuffer());

    // ✅ sanity check du résultat
    if (!this.isProbablyPdf(out)) {
      throw new BadRequestException({
        message: 'PDF merge failed: gotenberg returned non-PDF output',
        parts: this.summarizeParts(pdfs),
        outBytes: out.length,
        outHead: out.slice(0, 32).toString('hex'),
      } as any);
    }

    return out;
  }

  private async mergePdfs(absPaths: string[]): Promise<Uint8Array> {
    const merged = await PDFDocument.create();

    for (const p of absPaths) {
      const bytes = await fs.readFile(p);
      const pdf = await PDFDocument.load(bytes);
      const pages = await merged.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((pg) => merged.addPage(pg));
    }

    return await merged.save();
  }

  private async listDocsForLease(leaseId: string) {
    const r = await this.pool.query(
      `SELECT * FROM documents WHERE lease_id=$1 ORDER BY created_at ASC`,
      [leaseId],
    );
    return r.rows;
  }

  private pickDoc(docs: any[], type: string) {
    return docs.find((d) => d.type === type) || null;
  }

  // -------------------------------------
  // Signature guard helpers
  // -------------------------------------
  private tenantMissingFields(t: any): string[] {
    const missing: string[] = [];
    if (!this.normalizeText(t?.full_name)) missing.push('nom');
    if (!this.normalizeText(t?.birth_date)) missing.push('date de naissance');
    if (!this.normalizeText(t?.birth_place)) missing.push('lieu de naissance');
    if (!this.normalizeText(t?.current_address)) missing.push('adresse actuelle');
    return missing;
  }

  private async assertSignableLeaseOrThrow(leaseId: string) {
    const row = await this.fetchLeaseBundle(leaseId);
    const tenantsArr = this.parseJsonSafe(row.tenants_json);
    const tenants: any[] = Array.isArray(tenantsArr) && tenantsArr.length ? tenantsArr : [];

    // If for some reason tenants_json is empty, fall back to the principal tenant fields
    if (!tenants.length) {
      tenants.push({
        full_name: row.tenant_name,
        birth_date: row.birth_date,
        birth_place: row.birth_place,
        current_address: row.current_address,
        role: 'principal',
      });
    }

    const incomplete = tenants
      .map((t) => {
        const name = this.normalizeText(t?.full_name) || '(locataire sans nom)';
        const missing = this.tenantMissingFields(t);
        return { name, missing };
      })
      .filter((x) => x.missing.length > 0);

    if (incomplete.length > 0) {
      throw new BadRequestException(
        `Impossible de signer : informations locataires incomplètes.\n` +
          incomplete.map((x) => `- ${x.name} : ${x.missing.join(', ')}`).join('\n'),
      );
    }

    return row;
  }

  private getTenantsFromLeaseRow(row: any): any[] {
    const arr = this.parseJsonSafe(row?.tenants_json);
    const tenants: any[] = Array.isArray(arr) && arr.length ? arr : [];
    // fallback ultra-safe
    if (!tenants.length) {
      tenants.push({
        full_name: row.tenant_name,
        birth_date: row.birth_date,
        birth_place: row.birth_place,
        current_address: row.current_address,
        role: 'principal',
        tenant_id: row.tenant_id, // may be undefined
      });
    }
    return tenants;
  }

  private pickTenantIdFromSignature(sigRow: any): string {
    const a = sigRow?.audit_log;
    if (!a) return '';
    if (typeof a === 'object' && a.tenantId) return String(a.tenantId);
    try {
      const parsed = typeof a === 'string' ? JSON.parse(a) : null;
      return parsed?.tenantId ? String(parsed.tenantId) : '';
    } catch {
      return '';
    }
  }


  private isMultiSignableDocType(type: string): boolean {
    return [
      'CONTRAT',
      'GUARANTOR_ACT',
      'EDL_ENTREE',
      'INVENTAIRE_ENTREE',
      'EDL_SORTIE',
      'INVENTAIRE_SORTIE',
    ].includes(String(type || '').toUpperCase());
  }

  private getRequiredRolesForDocument(type: string): Array<'LOCATAIRE' | 'BAILLEUR' | 'GARANT'> {
    const docType = String(type || '').toUpperCase();

    if (docType === 'GUARANTOR_ACT') {
      return ['GARANT', 'BAILLEUR'];
    }

    if (
      docType === 'CONTRAT' ||
      docType === 'EDL_ENTREE' ||
      docType === 'INVENTAIRE_ENTREE' ||
      docType === 'EDL_SORTIE' ||
      docType === 'INVENTAIRE_SORTIE'
    ) {
      return ['LOCATAIRE', 'BAILLEUR'];
    }

    return [];
  }

  private buildPackAuditBlock(documents: Array<{
    id: string;
    type: string;
    filename?: string | null;
    originalSha256?: string | null;
    signedSha256?: string | null;
    signatures?: Array<{
      role: string;
      name: string;
      signedAt: string;
      ip?: string;
      userAgent?: string;
    }>;
  }>) {
    return {
      title: "Annexe technique — Journal de signature du pack",
      generatedAt: new Date().toISOString(),
      documents: documents.map((doc) => ({
        documentId: doc.id,
        type: doc.type,
        filename: doc.filename ?? null,
        sha256Original: doc.originalSha256 ?? null,
        sha256Signed: doc.signedSha256 ?? null,
        signatures: doc.signatures ?? [],
      })),
    };
  }

  private async getAuditEntryForSignedDocument(doc: any) {
    if (!doc) return null;

    const rootId = String(doc.parent_document_id || doc.id || '').trim();
    if (!rootId) return null;

    const rootQ = await this.pool.query(
      `SELECT id, type, filename, sha256 FROM documents WHERE id=$1 LIMIT 1`,
      [rootId],
    );
    const rootDoc = rootQ.rowCount ? rootQ.rows[0] : null;

    const sigQ = await this.pool.query(
      `SELECT * FROM signatures WHERE document_id=$1 ORDER BY sequence ASC`,
      [rootId],
    );
    const signatures = sigQ.rows || [];


    let originalSha = String(rootDoc?.sha256 || '');
    if (!originalSha && rootId) {
      const q = await this.pool.query(`SELECT sha256 FROM documents WHERE id=$1`, [rootId]);
      if (q.rowCount) originalSha = String(q.rows[0].sha256 || '');
    }

    let signedSha = String(doc?.sha256 || '');
    if (!signedSha) {
      try {
        const abs = this.absFromStoragePath(doc.storage_path);
        if (fsSync.existsSync(abs)) signedSha = this.sha256File(abs);
      } catch {}
    }

    return {
      id: rootId,
      type: String(doc.type || rootDoc?.type || ''),
      filename: String(doc.filename || ''),
      originalSha256: originalSha || null,
      signedSha256: signedSha || null,
      signatures: signatures.map((s: any) => ({
        role: String(s?.signer_role || ''),
        name: String(s?.signer_name || ''),
        signedAt: s?.signed_at ? new Date(s.signed_at).toISOString() : '',
        ip: String(s?.ip || ''),
        userAgent: String(s?.user_agent || ''),
        consent:
          s?.audit_log?.consent === true ||
          (typeof s?.audit_log === 'string' && s.audit_log.includes('"consent":true')),
      })),
    };
  }

  private async buildPackAuditPdf(
    documents: Array<{
      id: string;
      type: string;
      filename?: string | null;
      originalSha256?: string | null;
      signedSha256?: string | null;
      signatures?: Array<{
        role: string;
        name: string;
        signedAt: string;
        ip?: string;
        userAgent?: string;
        consent?: boolean;
      }>;
    }>,
  ) {
    const audit = this.buildPackAuditBlock(documents);

    const docsHtml = audit.documents
      .map((doc: any, index: number) => {
        const signaturesRows = (doc.signatures || [])
          .map(
            (s: any) => `
              <tr>
                <td>${this.escapeHtml(String(s.role || ''))}</td>
                <td>${this.escapeHtml(String(s.name || ''))}</td>
                <td>${this.escapeHtml(String(s.signedAt || ''))}</td>
                <td>${this.escapeHtml(String(s.ip || ''))}</td>
                <td style="font-size:10px;word-break:break-all">${this.escapeHtml(String(s.userAgent || ''))}</td>
                <td>${s.consent === true ? 'true' : 'false'}</td>
              </tr>
            `,
          )
          .join('');

        return `
          <div style="margin-bottom:28px">
            <h2 style="font-size:14px;margin:0 0 10px 0">
              Document ${index + 1} — ${this.escapeHtml(String(doc.type || ''))}
            </h2>

            <p><strong>Document ID :</strong> ${this.escapeHtml(String(doc.documentId || ''))}</p>
            <p><strong>Fichier :</strong> ${this.escapeHtml(String(doc.filename || ''))}</p>

            <p><strong>SHA256 original :</strong><br/>
              <span class="hash">${this.escapeHtml(String(doc.sha256Original || ''))}</span>
            </p>

            <p><strong>SHA256 signé :</strong><br/>
              <span class="hash">${this.escapeHtml(String(doc.sha256Signed || ''))}</span>
            </p>

            <table>
              <tr>
                <th>Rôle</th>
                <th>Nom</th>
                <th>Date (ISO)</th>
                <th>IP</th>
                <th>User-Agent</th>
                <th>Consent</th>
              </tr>
              ${signaturesRows || `<tr><td colspan="6">Aucune signature</td></tr>`}
            </table>
          </div>
        `;
      })
      .join('');

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; padding: 36px; }
    h1 { font-size: 18px; margin: 0 0 10px 0; }
    h2 { font-size: 14px; margin-top: 18px; }
    .hash { font-size: 10px; word-break: break-all; }
    .small { font-size: 10px; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    td, th { border: 1px solid #000; padding: 6px; vertical-align: top; }
    th { background: #eee; }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(audit.title)}</h1>
  <p class="small">Généré le ${this.escapeHtml(String(audit.generatedAt || ''))}</p>
  ${docsHtml}
</body>
</html>`;

    return this.htmlToPdfBuffer(html);
  }

  // -------------------------------------
  // Blocks
  // -------------------------------------

  private buildTenantsPlainLabel(row: AnyRow): string {
    const arr = this.parseJsonSafe(row?.tenants_json);
    const tenants: any[] = Array.isArray(arr) && arr.length ? arr : [];

    if (tenants.length) {
      return tenants
        .map((t: any) => {
          const name = this.normalizeText(t?.full_name || t?.name);
          const role = this.normalizeText(t?.role);
          return role ? `${name} (${role})` : name;
        })
        .filter(Boolean)
        .join(', ');
    }

    return this.normalizeText(row?.tenant_name) || '—';
  } 
   /**
   * - today: lease has 1 tenant (row.tenant_*)
   * - now: supports multi tenants through row.tenants_json (json array)
   */
  private buildTenantsBlock(row: AnyRow): string {
    if (row.tenants_block && String(row.tenants_block).includes('<')) return String(row.tenants_block);

    let tenants: Array<any> = [];
    try {
      if (Array.isArray(row.tenants)) tenants = row.tenants;
      else if (row.tenants_json) tenants = this.parseJsonSafe(row.tenants_json) ?? [];
    } catch {
      tenants = [];
    }

    const renderTenant = (t: any) => {
      const tName = this.normalizeText(t?.full_name || t?.name) ? this.escapeHtml(t.full_name || t.name) : this.missingSpan();
      const tEmail = this.normalizeText(t?.email) ? this.escapeHtml(t.email) : '—';
      const tPhone = this.normalizeText(t?.phone) ? this.escapeHtml(t.phone) : '—';
      const birthDate = this.normalizeText(t?.birth_date) ? this.escapeHtml(this.formatDateFr(t.birth_date)) : this.missingSpan();
      const birthPlace = this.normalizeText(t?.birth_place) ? this.escapeHtml(t.birth_place) : this.missingSpan();
      const currentAddress = this.normalizeText(t?.current_address) ? this.escapeHtml(t.current_address) : this.missingSpan();
      const role = this.escapeHtml(t?.role || '');
      const roleLabel = role ? ` <span class="small">(${role})</span>` : '';

      return `
        <div style="margin-bottom:8px">
          <div><b>${tName}</b>${roleLabel}</div>
          <div class="small">${tEmail} — ${tPhone}</div>
          <div class="small">Né(e) le ${birthDate} à ${birthPlace}</div>
          <div class="small">Adresse actuelle : ${currentAddress}</div>
        </div>
      `;
    };

    if (Array.isArray(tenants) && tenants.length) {
      return tenants.map(renderTenant).join('');
    }

    // single tenant fallback
    return renderTenant({
      full_name: row.tenant_name,
      email: row.tenant_email,
      phone: row.tenant_phone,
      birth_date: row.birth_date,
      birth_place: row.birth_place,
      current_address: row.current_address,
      role: 'principal',
    });
  }

  private getTenantsCount(row: AnyRow): number {
    const arr = this.parseJsonSafe(row.tenants_json);
    return Array.isArray(arr) && arr.length ? arr.length : 1;
  }

  /**
   * ✅ Colocation clause “béton” si >1 locataire
   * - solidarité / indivisibilité
   * - départ d’un cotenant : le bail continue
   */
  private buildColocationClause(row: AnyRow): string {
    if (row.colocation_clause && String(row.colocation_clause).includes('<')) return String(row.colocation_clause);

    const n = this.getTenantsCount(row);
    if (!n || n <= 1) {
      return `<div class="small">Sans objet (bail conclu avec un seul locataire).</div>`;
    }

    return `
      <div class="small">
        <b>Colocation — bail unique :</b><br/>
        Le présent contrat est conclu avec <b>${n}</b> locataire(s). Les locataires sont tenus <b>solidairement</b> au paiement du loyer,
        des charges, des indemnités d’occupation et, le cas échéant, des réparations locatives dues au titre du présent bail.<br/><br/>
        <b>Indivisibilité :</b> le congé donné par un seul colocataire (ou son départ) n’emporte pas résiliation du bail.
        Le bail se poursuit avec le(s) colocataire(s) restant(s). Tout remplacement d’un colocataire ou ajout/suppression
        d’un cotenant doit faire l’objet d’un <b>avenant</b> établi par le bailleur.<br/><br/>
        Les colocataires s’organisent entre eux pour la répartition interne des paiements. Le bailleur peut réclamer l’intégralité
        des sommes dues à n’importe lequel des colocataires.
      </div>
    `;
  }

  private listToBadges(title: string, items: any[] | undefined): string {
    const arr = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!arr.length) return `<div class="small"><b>${title} :</b> —</div>`;
    return `<div class="small"><b>${title} :</b> ${arr.map((x) => this.escapeHtml(x)).join(', ')}</div>`;
  }

  private buildDesignationBlock(row: AnyRow): string {
    let d: any = null;
    try {
      d = row.lease_designation
        ? typeof row.lease_designation === 'string'
          ? JSON.parse(row.lease_designation)
          : row.lease_designation
        : null;
    } catch {
      d = null;
    }

    const addr = `${this.escapeHtml(row.unit_address_line1)}, ${this.escapeHtml(row.unit_postal_code)} ${this.escapeHtml(
      row.unit_city,
    )}`;
    const buildingName = this.escapeHtml(row.building_name || d?.buildingName || '-');
    const batiment = this.escapeHtml(d?.batiment || '-');
    const etage = this.escapeHtml(d?.etagePrecision || (row.floor != null ? `Étage ${row.floor}` : '-') || '-');
    const porte = this.escapeHtml(d?.porte || row.unit_code || '-');
    const superficie = d?.superficieM2 ?? row.surface_m2 ?? null;

    const usageMixte = Boolean(d?.usageMixte);
    const usage = usageMixte ? 'usage mixte (habitation + professionnel)' : 'usage d’habitation';

    const consistance = this.escapeHtml(d?.consistance || row.unit_label || '-');
    const descriptif = this.escapeHtml(d?.description || '');

    const chauffage = this.escapeHtml(d?.chauffageType || '-');
    const eauChaude = this.escapeHtml(d?.eauChaudeType || '-');

    const dependances = Array.isArray(d?.dependances) ? d.dependances : [];
    const exterieurs = Array.isArray(d?.exterieurs) ? d.exterieurs : [];
    const communs = Array.isArray(d?.equipementsCommuns) ? d.equipementsCommuns : [];

    return `
      <table class="kv">
        <tr><td class="k">Adresse des locaux loués</td><td>${addr}</td></tr>
        <tr><td class="k">Immeuble</td><td>${buildingName}</td></tr>
        <tr><td class="k">Bâtiment / Étage / Porte</td><td>${batiment} — ${etage} — Porte ${porte}</td></tr>
        <tr><td class="k">Superficie</td><td>${superficie != null ? `${this.escapeHtml(superficie)} m²` : '—'}</td></tr>
        <tr><td class="k">Usage</td><td>${this.escapeHtml(usage)}</td></tr>
        <tr><td class="k">Consistance</td><td>${consistance}</td></tr>
        ${descriptif ? `<tr><td class="k">Descriptif</td><td>${descriptif}</td></tr>` : ''}
        <tr><td class="k">Chauffage</td><td>${chauffage}</td></tr>
        <tr><td class="k">Eau chaude</td><td>${eauChaude}</td></tr>
      </table>
      <div style="margin-top:8px">
        ${this.listToBadges('Dépendances', dependances)}
        ${this.listToBadges('Extérieurs', exterieurs)}
        ${this.listToBadges('Équipements communs', communs)}
      </div>
    `;
  }

  /**
   * ✅ Garants multiples supportés via:
   * - l.guarantors_json (array)
   * Fallback:
   * - l.guarantor_full_name / email / phone / address
   */
  private buildGuarantorBlock(row: AnyRow): string {
    if (row.guarantor_block && String(row.guarantor_block).includes('<')) return String(row.guarantor_block);
    
    const gArr = this.parseJsonSafe((row as any).guarantors_json);
    const guarantors: any[] = Array.isArray(gArr) ? gArr : [];

    // fallback legacy single guarantor
    if (
      !guarantors.length &&
      (row.guarantor_full_name || row.guarantor_email || row.guarantor_phone || row.guarantor_address)
    ) {
      guarantors.push({
        full_name: row.guarantor_full_name,
        email: row.guarantor_email,
        phone: row.guarantor_phone,
        address: row.guarantor_address,
      });
    }

    if (!guarantors.length) {
      return `<div class="small" style="margin-top:6px"><b>Caution solidaire :</b> aucune (non prévue).</div>
    <div style="margin-top:10px; border-top:1px solid #e5e7eb"></div>`;
    }

    const items = guarantors
      .map((g, idx) => {
        const name = this.normalizeText(g?.full_name || g?.name)
          ? this.escapeHtml(g.full_name || g.name)
          : this.escapeHtml(`Garant #${idx + 1}`);
        const email = this.normalizeText(g?.email) ? this.escapeHtml(g.email) : '—';
        const phone = this.normalizeText(g?.phone) ? this.escapeHtml(g.phone) : '—';
        const address = this.normalizeText(g?.address || g?.current_address)
          ? this.escapeHtml(g.address || g.current_address)
          : this.missingSpan();
        return `
          <div style="margin:6px 0 10px 0">
            <div><b>${name}</b></div>
            <div class="small">${email} — ${phone}</div>
            <div class="small">Adresse : ${address}</div>
          </div>
        `;
      })
      .join('');

    return `
      <div style="margin-top:6px" class="small">
        <b>Caution solidaire :</b> oui (garant(s) ci-dessous).<br/>
        La/Les caution(s) s’engage(nt) solidairement au paiement des sommes dues au titre du bail selon l’acte de cautionnement annexé.
      </div>
      <div style="margin-top:8px">${items}</div>
      <div style="margin-top:10px; border-top:1px solid #e5e7eb"></div>
    `;
  }

  private async buildLeaseGuaranteesBlock(leaseId: string, row: AnyRow): Promise<string> {
    const leaseIdTrim = String(leaseId || '').trim();

    if (leaseIdTrim) {
      const q = await this.pool.query(
        `
        SELECT
          lg.id AS guarantee_id,
          lg.type,
          lg.selected,
          lg.guarantor_full_name,
          lg.guarantor_email,
          lg.guarantor_phone,
          lt.role,
          t.full_name AS tenant_full_name
        FROM lease_guarantees lg
        JOIN lease_tenants lt ON lt.id = lg.lease_tenant_id
        JOIN tenants t ON t.id = lt.tenant_id
        WHERE lg.lease_id = $1
          AND lg.selected = true
        ORDER BY
          CASE WHEN lt.role = 'principal' THEN 0 ELSE 1 END,
          t.full_name ASC,
          lg.created_at ASC
        `,
        [leaseIdTrim],
      );

      const guarantees = q.rows || [];
      const cautions = guarantees.filter((g: any) => String(g.type || '').toUpperCase() === 'CAUTION');
      const visales = guarantees.filter((g: any) => String(g.type || '').toUpperCase() === 'VISALE');

      if (cautions.length || visales.length) {
        const cautionItems = cautions
          .map((g: any, idx: number) => {
            const guarantorName = this.normalizeText(g.guarantor_full_name)
              ? this.escapeHtml(g.guarantor_full_name)
              : this.escapeHtml(`Caution #${idx + 1}`);

            const tenantName = this.normalizeText(g.tenant_full_name)
              ? this.escapeHtml(g.tenant_full_name)
              : 'Locataire concerné non renseigné';

            const email = this.normalizeText(g.guarantor_email)
              ? this.escapeHtml(g.guarantor_email)
              : '—';

            const phone = this.normalizeText(g.guarantor_phone)
              ? this.escapeHtml(g.guarantor_phone)
              : '—';

            return `
              <div style="margin:6px 0 10px 0">
                <div><b>${guarantorName}</b></div>
                <div class="small">Locataire garanti : ${tenantName}</div>
                <div class="small">${email} — ${phone}</div>
                <div class="small">Acte de cautionnement solidaire annexé au bail.</div>
              </div>
            `;
          })
          .join('');

        const visaleItems = visales
          .map((g: any) => {
            const tenantName = this.normalizeText(g.tenant_full_name)
              ? this.escapeHtml(g.tenant_full_name)
              : 'Locataire concerné non renseigné';

            return `
              <div style="margin:6px 0 10px 0">
                <div><b>Garantie VISALE</b></div>
                <div class="small">Locataire couvert : ${tenantName}</div>
              </div>
            `;
          })
          .join('');

        return `
          <div style="margin-top:6px" class="small">
            <b>Garanties :</b> oui.<br/>
            ${
              cautions.length
                ? `Le bail est assorti de ${cautions.length} acte(s) de cautionnement solidaire annexé(s), chacun rattaché à un locataire garanti expressément identifié.`
                : ''
            }
            ${
              visales.length
                ? `<br/>Le bail comporte également ${visales.length} garantie(s) VISALE.`
                : ''
            }
          </div>
          <div style="margin-top:8px">
            ${cautionItems}
            ${visaleItems}
          </div>
          <div style="margin-top:10px; border-top:1px solid #e5e7eb"></div>
        `;
      }
    }

    return this.buildGuarantorBlock(row);
  }

  /**
   * ✅ Visale supporté via:
   * - l.visale_json (object)
   * fallback:
   * - l.visale_visa_number / l.visale_enabled etc. (si existant)
   */
  private buildVisaleBlock(row: AnyRow): string {
    if (row.visale_block && String(row.visale_block).includes('<')) return String(row.visale_block);

    // ✅ NEW: read from lease_terms.visale (source métier récente)
    // row.lease_terms peut être un objet (pg) ou une string JSON
    const terms =
      typeof row?.lease_terms === 'string'
        ? (this.parseJsonSafe(row.lease_terms) || {})
        : (row?.lease_terms || {});
    const vTerms = (terms && typeof terms === 'object') ? (terms.visale || {}) : {};

    const enabledTerms = vTerms?.enabled === true;
    const visaNumberTerms = vTerms?.visaNumber ? String(vTerms.visaNumber) : '';

    // Existing: visale_json (legacy)
    const v = this.parseJsonSafe(row.visale_json) || null;

    // fallback simple (si tu as déjà des colonnes)
    const enabledFallback = String(row.visale_enabled ?? '').toLowerCase() === 'true' || row.visale_enabled === 1;
    const visaNumberFallback = row.visale_visa_number || row.visaleVisaNumber;

    // ✅ enabled: priorité v.enabled, sinon lease_terms.visale.enabled, sinon fallback colonnes
    const enabled = Boolean(
      (v?.enabled === true) ||
      (enabledTerms === true) ||
      (enabledFallback === true)
    );

    if (!enabled) {
      return `<div class="small" style="margin-top:10px"><b>Garantie Visale :</b> non (non prévue).</div>`;
    }

    // ✅ values: priorité v.*, sinon lease_terms.visale.*, sinon fallback colonnes
    const visaNumberRaw =
      (v?.visaNumber != null ? String(v.visaNumber) : '') ||
      visaNumberTerms ||
      (visaNumberFallback != null ? String(visaNumberFallback) : '');

    const tenantRefRaw =
      (v?.tenantRef ?? v?.locataireRef ?? vTerms?.tenantRef ?? vTerms?.locataireRef ?? '');

    const landlordRefRaw =
      (v?.landlordRef ?? v?.bailleurRef ?? vTerms?.landlordRef ?? vTerms?.bailleurRef ?? '');

    const plafondRaw =
      (v?.maxAmountEur ?? vTerms?.maxAmountEur ?? null);

    const startRaw =
      (v?.startDate ?? vTerms?.startDate ?? null);

    const endRaw =
      (v?.endDate ?? vTerms?.endDate ?? null);

    const visaNumber = this.escapeHtml(visaNumberRaw || '—');
    const tenantRef = this.escapeHtml(tenantRefRaw || '—');
    const landlordRef = this.escapeHtml(landlordRefRaw || '—');
    const plafond = plafondRaw != null ? this.escapeHtml(plafondRaw) : '—';
    const start = startRaw ? this.escapeHtml(this.formatDateFr(startRaw)) : '—';
    const end = endRaw ? this.escapeHtml(this.formatDateFr(endRaw)) : '—';

    return `
      <div class="small" style="margin-top:10px">
        <b>Garantie Visale :</b> oui.<br/>
        <b>Visa / Référence :</b> ${visaNumber}<br/>
        <b>Référence locataire :</b> ${tenantRef} — <b>Référence bailleur :</b> ${landlordRef}<br/>
        <b>Période :</b> ${start} → ${end} — <b>Plafond (indicatif) :</b> ${plafond}${plafond === '—' ? '' : ' €'}<br/>
        Les parties conviennent que la garantie Visale s’applique selon les conditions du dispositif et des documents annexés.
      </div>
    `;
  }

  private defaultIrl(row: AnyRow): { quarter: string; value: string } {
    const q = row.irl_reference_quarter || 'IRL T4 2025';
    const v = row.irl_reference_value || '—';
    return { quarter: String(q), value: String(v) };
  }

  private async getLatestLeaseRevision(leaseId: string) {
    const r = await this.pool.query(
      `SELECT *
      FROM lease_revisions
      WHERE lease_id=$1
      ORDER BY revision_date DESC
      LIMIT 1`,
      [leaseId],
    );
    return r.rowCount ? r.rows[0] : null;
  }

  private async getLeaseRevisionByDate(leaseId: string, revisionDateIso: string) {
    const r = await this.pool.query(
      `SELECT *
      FROM lease_revisions
      WHERE lease_id=$1 AND revision_date=$2::date
      LIMIT 1`,
      [leaseId, revisionDateIso],
    );
    return r.rowCount ? r.rows[0] : null;
  }

  private normalizeLeaseTermsForContract(row: any) {
  // row.lease_terms peut déjà être un objet (pg) ou une string
  let t: any = {};
  try {
    if (row?.lease_terms && typeof row.lease_terms === 'object') t = row.lease_terms;
    else if (typeof row?.lease_terms === 'string' && row.lease_terms.trim()) t = JSON.parse(row.lease_terms);
  } catch {
    t = {};
  }

  const leaseType = String(t.leaseType || t.leaseKind || row?.kind || 'MEUBLE_RP').toUpperCase();

  // rétrocompat: specialClause -> specialClauses
  const specialClauses = String(t.specialClauses ?? t.specialClause ?? '').trim();

  // IRL indexation bloc
  const irlIdx = t.irlIndexation && typeof t.irlIndexation === 'object' ? t.irlIndexation : {};
  const irlEnabled = !!irlIdx.enabled;

  const out = {
    leaseType,

    durationMonths: Number.isFinite(+t.durationMonths) ? +t.durationMonths : 12,
    tacitRenewal: t.tacitRenewal ?? true,

    noticeTenantMonths: Number.isFinite(+t.noticeTenantMonths) ? +t.noticeTenantMonths : 1,
    noticeLandlordMonths: Number.isFinite(+t.noticeLandlordMonths) ? +t.noticeLandlordMonths : 3,

    solidarityClause: !!t.solidarityClause,

    irlIndexation: {
      enabled: irlEnabled,
      referenceQuarter: irlEnabled ? (irlIdx.referenceQuarter ?? null) : null,
      referenceValue: irlEnabled ? (irlIdx.referenceValue ?? null) : null,
    },

    insuranceRequired: t.insuranceRequired ?? true,
    sublettingAllowed: t.sublettingAllowed ?? false,

    petsPolicy: ['UNKNOWN', 'ALLOWED', 'FORBIDDEN'].includes(String(t.petsPolicy))
      ? String(t.petsPolicy)
      : 'UNKNOWN',

    specialClauses,
  };

  return out;
}

  private buildLandlordIdentifiersHtml(): string {
    const parts: string[] = [];
    const siren = (process.env.LANDLORD_SIREN || '').trim();
    const siret = (process.env.LANDLORD_SIRET || '').trim();
    const rcs = (process.env.LANDLORD_RCS || '').trim();
    const naf = (process.env.LANDLORD_NAF || '').trim();
    if (siren) parts.push(`<div>SIREN : ${this.escapeHtml(siren)}</div>`);
    if (siret) parts.push(`<div>SIRET : ${this.escapeHtml(siret)}</div>`);
    if (rcs) parts.push(`<div>RCS : ${this.escapeHtml(rcs)}</div>`);
    if (naf) parts.push(`<div>Code NAF : ${this.escapeHtml(naf)}</div>`);
    return parts.length ? parts.join('') : '';
  }

  // Clause charges (FORFAIT / PROVISION)
  private buildChargesClauseHtml(row: AnyRow): string {
    const modeRaw = String(row.charges_mode || 'FORFAIT').toUpperCase().trim();
    const chargesHasValue = row.charges_cents != null;
    const chargesEur = chargesHasValue ? this.toEuros(row.charges_cents) : '—';

    if (modeRaw === 'PROVISION') {
      return `
        <div class="small">
          <b>Charges récupérables — provision :</b><br/>
          Les charges font l’objet d’une <b>provision mensuelle</b> de <b>${chargesEur}${chargesEur === '—' ? '' : ' €'}</b>,
          avec <b>régularisation annuelle</b> sur justificatifs conformément aux dispositions légales.
          Le bailleur communiquera un décompte des charges et tiendra à disposition les pièces justificatives.
        </div>
      `;
    }

    return `
      <div class="small">
        <b>Charges — forfait :</b><br/>
        Les charges sont fixées sous forme de <b>forfait mensuel</b> de <b>${chargesEur}${chargesEur === '—' ? '' : ' €'}</b>.
        Ce forfait est <b>non régularisable</b> (sauf accord contraire écrit / dispositions légales applicables).
      </div>
    `;
  }

  private addYearsAnniversaryIso(d: any, years = 1): string {
    const iso = this.isoDate(d);
    if (!iso) return '';
    const [y, m, day] = iso.split('-').map((x) => parseInt(x, 10));
    // Construire une date UTC pour éviter les surprises de TZ
    const dt = new Date(Date.UTC(y, m - 1, day));
    dt.setUTCFullYear(dt.getUTCFullYear() + years);
    // YYYY-MM-DD
    return dt.toISOString().slice(0, 10);
  }

  private buildIrlClauseHtml(row: AnyRow): string {
    // Source of truth: lease_terms.irlIndexation.enabled (normalisé)
    const terms = this.normalizeLeaseTermsForContract(row);
    const enabled = !!terms?.irlIndexation?.enabled;

    if (!enabled) {
      return `
  <p>Le loyer n’est pas indexé (absence de clause de révision).</p>
  `;
    }

  // ✅ Date anniversaire: start_date + 1 an
  const nextIso =
    row.next_revision_date
      ? this.isoDate(row.next_revision_date)
      : this.addYearsAnniversaryIso(row.start_date, 1);
  const nextRevisionFr = nextIso ? this.formatDateFr(nextIso) : this.missingSpan('Date de révision à compléter');

  // Référence IRL (déjà portée par terms + fallback colonnes leases.*)
  const irl = this.defaultIrl(row);
  const refQuarter = String(terms.irlIndexation?.referenceQuarter ?? irl.quarter ?? '').trim();
  const refValue = String(terms.irlIndexation?.referenceValue ?? irl.value ?? '').trim();

  const refQuarterSafe = refQuarter ? this.escapeHtml(refQuarter) : this.missingSpan('Trimestre IRL à compléter');
  const refValueSafe = refValue ? this.escapeHtml(refValue) : this.missingSpan('Valeur IRL à compléter');

  return `
<p>
  Le loyer hors charges pourra être révisé une fois par an, à la date du <strong>${this.escapeHtml(nextRevisionFr)}</strong>
  (puis à chaque échéance annuelle), en fonction de la variation de l’Indice de Référence des Loyers (IRL) publié par l’Insee.
</p>
<p>
  Indice de référence : <strong>${refQuarterSafe}</strong> — valeur <strong>${refValueSafe}</strong>.
</p>
<p>
  Formule : <strong>Nouveau loyer = Loyer hors charges × (IRL applicable à la date de révision / IRL de référence)</strong>.
</p>
`;
}

// -------------------------------------
// GUARANTOR_ACT — candidates (UI helper)
// -------------------------------------
async getGuarantorActCandidates(leaseId: string) {
  const leaseIdTrim = String(leaseId || '').trim();
  if (!leaseIdTrim) throw new BadRequestException('Missing leaseId');

  const q = await this.pool.query(
    `
    SELECT
      lg.id AS guarantee_id,
      lg.lease_tenant_id,
      lt.tenant_id,
      lt.role,
      t.full_name AS tenant_full_name,
      t.email AS tenant_email,
      lg.guarantor_full_name,
      lg.guarantor_email,
      lg.guarantor_phone
    FROM lease_guarantees lg
    JOIN lease_tenants lt ON lt.id = lg.lease_tenant_id
    JOIN tenants t ON t.id = lt.tenant_id
    WHERE lg.lease_id = $1
      AND lg.type = 'CAUTION'
      AND lg.selected = true
    ORDER BY CASE WHEN lt.role='principal' THEN 0 ELSE 1 END, lt.created_at ASC, lg.created_at ASC
    `,
    [leaseIdTrim],
  );

  return (q.rows || []).map((r: any) => ({
    guaranteeId: r.guarantee_id,
    leaseTenantId: r.lease_tenant_id,
    tenantId: r.tenant_id,
    tenantFullName: r.tenant_full_name,
    tenantEmail: r.tenant_email,
    role: r.role,
    guarantorFullName: r.guarantor_full_name,
    guarantorEmail: r.guarantor_email,
    guarantorPhone: r.guarantor_phone,
  }));
}

// ✅ UI-friendly: toujours une structure stable
async listGuarantorActCandidates(leaseId: string) {
  const leaseIdTrim = String(leaseId || '').trim();
  const candidates = await this.getGuarantorActCandidates(leaseIdTrim);

  return {
    leaseId: leaseIdTrim,
    count: candidates.length,
    candidates,
  };
}

// ===============================
// ACKNOWLEDGE (prise de connaissance)
// ===============================
async acknowledgeDocument(args: {
  documentId: string;
  tenantId: string;
  ip: string | null;
  userAgent: string | null;
}) {
  const documentId = String(args.documentId || '').trim();
  const tenantId = String(args.tenantId || '').trim();

  if (!documentId) throw new BadRequestException('Missing documentId');
  if (!tenantId) throw new BadRequestException('Missing tenantId');

  // 1) Charge le doc pour récupérer lease_id
  const docQ = await this.pool.query(
    `SELECT id, lease_id, parent_document_id, filename, signed_final_document_id, type
     FROM documents
     WHERE id=$1
     LIMIT 1`,
    [documentId],
  );
  if (!docQ.rowCount) throw new BadRequestException('Document not found');
  const doc = docQ.rows[0];
  // ✅ Correctif 2: empêcher l'ACK sur autre chose que le PDF SIGNED_FINAL
  const filename = String(doc.filename || '');
  const type = String(doc.type || '');
  const isSignedFinal =
    Boolean(doc.parent_document_id) || filename.includes('SIGNED_FINAL');

  if (!isSignedFinal) {
    throw new BadRequestException('ACK requires a SIGNED_FINAL document');
  }

  const leaseId = String(doc.lease_id || '').trim();
  if (!leaseId) throw new BadRequestException('Document has no lease_id');

  // 2) Vérifie que le tenant appartient bien au bail (sécurité/consistance)
  const ltQ = await this.pool.query(
    `SELECT 1
     FROM lease_tenants
     WHERE lease_id=$1 AND tenant_id=$2
     LIMIT 1`,
    [leaseId, tenantId],
  );
  if (!ltQ.rowCount) throw new BadRequestException('tenantId not in this lease');

  // 3) Upsert ACK (idempotent)
  const insQ = await this.pool.query(
    `
    INSERT INTO document_acknowledgements (document_id, lease_id, tenant_id, ip, user_agent)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (document_id, tenant_id)
    DO UPDATE SET acknowledged_at = EXCLUDED.acknowledged_at,
                  ip = EXCLUDED.ip,
                  user_agent = EXCLUDED.user_agent
    RETURNING document_id, tenant_id, acknowledged_at
    `,
    [documentId, leaseId, tenantId, args.ip, args.userAgent],
  );

  return {
    ok: true,
    documentId,
    tenantId,
    acknowledgedAt: insQ.rows?.[0]?.acknowledged_at || new Date().toISOString(),
  };
}

// -------------------------------------
// Documents list & downloads
// -------------------------------------
async listByLease(leaseId: string) {
    const r = await this.pool.query(`SELECT * FROM documents WHERE lease_id=$1 ORDER BY created_at DESC`, [leaseId]);
    return r.rows;
  }

    /**
   * Group documents by "root" (= parent_document_id OR self id).
   * Useful for UI: show one line per "document flow" (original + signed + pack_final, etc).
   */
  async listByLeaseGrouped(leaseId: string) {
    const docs = await this.listByLease(leaseId);

    const byId = new Map<string, any>();
    docs.forEach((d: any) => byId.set(String(d.id), d));

    const rootIdOf = (d: any): string => {
      if (d.parent_document_id) return String(d.parent_document_id);
      return String(d.id);
    };

    const groups = new Map<string, any[]>();
    for (const d of docs) {
      const rid = rootIdOf(d);
      const arr = groups.get(rid) || [];
      arr.push(d);
      groups.set(rid, arr);
    }

    const out = Array.from(groups.entries()).map(([rootId, items]) => {
      const original =
        byId.get(String(rootId)) ||
        items.find((x) => !x.parent_document_id) ||
        items[0];

      const signedFinal =
        (original?.signed_final_document_id ? byId.get(String(original.signed_final_document_id)) : null) ||
        items.find((x) => String(x.filename || '').includes('_SIGNED_FINAL')) ||
        null;

      const packFinal =
        items.find((x) => x.type === 'PACK_FINAL' && String(x.filename || '').includes('PACK_FINAL_V2_')) ||
        items.find((x) => x.type === 'PACK_FINAL') ||
        null;
      
      const edlEntree =
        items.find((x) => x.type === 'EDL_ENTREE') || null;

      const inventaireEntree =
        items.find((x) => x.type === 'INVENTAIRE_ENTREE') || null;

      const edlSortie =
        items.find((x) => x.type === 'EDL_SORTIE') || null;

      const inventaireSortie =
        items.find((x) => x.type === 'INVENTAIRE_SORTIE') || null;

      return {
        rootId,
        type: original?.type,
        lease_id: original?.lease_id,
        unit_id: original?.unit_id,
        original,
        signedFinal,
        packFinal,
        edlEntree,
        inventaireEntree,
        edlSortie,
        inventaireSortie,
        items: items.sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at))),
      };
    });

    out.sort((a: any, b: any) =>
      String(b.original?.created_at || '').localeCompare(String(a.original?.created_at || '')),
    );

    return out;
  }

  async getDocumentFile(documentId: string) {
    const r = await this.pool.query(`SELECT * FROM documents WHERE id=$1`, [documentId]);
    if (!r.rowCount) throw new BadRequestException('Unknown document');
    const doc = r.rows[0];
    const absPath = this.absFromStoragePath(doc.storage_path);
    return { absPath, filename: doc.filename };
  }

  private async fetchLeaseBundle(leaseId: string, asOfDate?: string) {
    const q = await this.pool.query(
      `SELECT
          l.*,
          COALESCE(a.rent_cents, l.rent_cents) as rent_cents,
          COALESCE(a.charges_cents, l.charges_cents) as charges_cents,
          COALESCE(a.deposit_cents, l.deposit_cents) as deposit_cents,
          COALESCE(a.payment_day, l.payment_day) as payment_day,
          u.id as unit_id,
          u.code as unit_code,
          u.label as unit_label,
          u.address_line1 as unit_address_line1,
          u.city as unit_city,
          u.postal_code as unit_postal_code,
          u.surface_m2,
          u.floor,
          u.project_id as project_id,
          p.name as project_name,
          b.name as building_name,
          t.full_name as tenant_name,
          t.email as tenant_email,
          t.phone as tenant_phone,
          t.birth_date,
          t.birth_place,
          t.current_address,
          (
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'tenant_id', tt.id,
                  'full_name', tt.full_name,
                  'email', tt.email,
                  'phone', tt.phone,
                  'birth_date', tt.birth_date,
                  'birth_place', tt.birth_place,
                  'current_address', tt.current_address,
                  'role', lt.role
                )
                ORDER BY CASE WHEN lt.role='principal' THEN 0 ELSE 1 END, lt.created_at
              ),
              '[]'::json
            )
            FROM lease_tenants lt
            JOIN tenants tt ON tt.id = lt.tenant_id
            WHERE lt.lease_id = l.id
          ) as tenants_json
        FROM leases l
        JOIN units u ON u.id = l.unit_id
        JOIN tenants t ON t.id = l.tenant_id
        LEFT JOIN projects p ON p.id = u.project_id
        LEFT JOIN buildings b ON b.id = u.building_id
        LEFT JOIN LATERAL (
          SELECT rent_cents, charges_cents, deposit_cents, payment_day
          FROM lease_amounts
          WHERE lease_id = l.id
            AND effective_date <= COALESCE($2::date, CURRENT_DATE)
          ORDER BY effective_date DESC
          LIMIT 1
        ) a ON TRUE
        WHERE l.id=$1`,
      [leaseId, asOfDate ?? null],
    );
    if (!q.rowCount) throw new BadRequestException('Unknown leaseId');
    return q.rows[0];
  }

  private async getLandlordForLease(leaseId: string) {
  const q = await this.pool.query(
    `
    SELECT pl.*
    FROM leases l
    JOIN units u ON u.id = l.unit_id
    JOIN projects p ON p.id = u.project_id
    LEFT JOIN project_landlords pl ON pl.id = p.landlord_id
    WHERE l.id = $1
    `,
    [leaseId],
  );
  return q.rowCount ? q.rows[0] : null;
}

  // -------------------------------------
  // CONTRAT (templated)
  // -------------------------------------
  async generateContractPdf(leaseId: string, opts?: {force?: boolean}) {
    const force = !!opts?.force;
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const leaseBase = await this.pool.query(`SELECT start_date FROM leases WHERE id=$1`, [leaseId]);
    if (!leaseBase.rowCount) throw new BadRequestException('Unknown leaseId');
    const asOf = this.isoDate(leaseBase.rows[0].start_date);

    const row = await this.fetchLeaseBundle(leaseId, asOf);
    const landlord = await this.getLandlordForLease(leaseId);

    if (!landlord) {
      throw new BadRequestException({
        message: 'Contract not ready: missing landlord information',
        missing: ['landlord_profile'],
      });
    }

    const landlord_identifiers_html = `
    <div><b>${this.escapeHtml(landlord.name)}</b></div>
    <div>${this.escapeHtml(landlord.address)}</div>
    <div>Email : ${this.escapeHtml(landlord.email)} — Tél : ${this.escapeHtml(landlord.phone)}</div>
  `.trim();

    const leaseKind = String(row.kind || 'MEUBLE_RP').toUpperCase() as LeaseKind;
    if (leaseKind !== 'MEUBLE_RP' && leaseKind !== 'NU_RP' && leaseKind !== 'SAISONNIER') {
      throw new BadRequestException(`Unsupported lease kind for contract: ${leaseKind}`);
    }

    const templateVersion = '2026-04';
    const tpl = await this.getTemplate('CONTRACT', leaseKind, templateVersion);
    console.warn("[TPL DEBUG]", {
      id: tpl.id,
      kind: tpl.kind,
      lease_kind: tpl.lease_kind,
      version: tpl.version,
      len: tpl.html_template?.length,
      head: (tpl.html_template || "").slice(0, 120),
    });
    const irl = this.defaultIrl(row);
    const terms = this.normalizeLeaseTermsForContract(row);

    // ✅ IMPORTANT: déclarer pdfName ici
    const pdfName = `CONTRAT_${leaseKind}_${row.unit_code}_${this.isoDate(row.start_date)}.pdf`;

    // ✅ IDEMPOTENCE: if same generated contract already exists (same filename), return it.
    const existing = await this.findExistingDocByFilename({
      leaseId,
      type: 'CONTRAT',
      filename: pdfName,
      parentNullOnly: true,
    });

    if (existing) {
      if (!force) {
        return { created: false, document: existing };
      }

      // force === true
      if (existing.signed_final_document_id) {
        throw new BadRequestException('Cannot force rebuild: contract already finalized (SIGNED_FINAL exists)');
      }

      const sigQ = await this.pool.query(
        `SELECT 1 FROM signatures WHERE document_id=$1 LIMIT 1`,
        [existing.id],
      );
      if (sigQ.rowCount) {
        throw new BadRequestException('Cannot force rebuild: signatures already exist on this contract');
      }

      // purge DB + file
      const abs = this.absFromStoragePath(existing.storage_path);
      await this.deleteDocumentRow(existing.id);
      await this.safeUnlinkAbs(abs);
    }



    const vars: Record<string, any> = {
      template_version: templateVersion,
      lease_id_short: this.leaseIdShort(leaseId),

      // Dates FR
      start_date: this.formatDateFr(row.start_date),
      end_date_theoretical: this.formatDateFr(row.end_date_theoretical),

      //Unité et projet
      unit_code: this.escapeHtml(row.unit_code),
      unit_label: this.escapeHtml(row.unit_label),
      unit_address_line1: this.escapeHtml(row.unit_address_line1),
      unit_postal_code: this.escapeHtml(row.unit_postal_code),
      unit_city: this.escapeHtml(row.unit_city),
      project_name: this.escapeHtml(row.project_name || '-'),
      building_name: this.escapeHtml(row.building_name || '-'),

      // ✅ Nouveau bloc bailleur
      landlord_identifiers_html,  // <- on remplace buildLandlordIdentifiersHtml
      landlord_name: this.escapeHtml(landlord.name),
      landlord_address: this.escapeHtml(landlord.address),
      landlord_email: this.escapeHtml(landlord.email),
      landlord_phone: this.escapeHtml(landlord.phone),


      tenants_block: this.buildTenantsBlock(row),
      tenant_name: this.escapeHtml(row.tenant_name || ''),

      designation_block: this.buildDesignationBlock(row),

      // ✅ NEW: nombre de clés
      keys_count: row.keys_count != null ? String(row.keys_count) : '—',

      // ✅ NEW: annexes affichées dans le contrat (HTML)
      annexes_contract_html: (() => {
        const items: string[] = [];
        items.push('État des lieux');
        if (leaseKind !== 'SAISONNIER') items.push('Notice d’information');
        items.push('Dossier de diagnostic technique');
        if (leaseKind === 'MEUBLE_RP') items.push('Inventaire du mobilier');

        return `<ul>${items.map((x) => `<li>${this.escapeHtml(x)}</li>`).join('')}</ul>`;
      })(),

      colocation_clause: this.buildColocationClause(row),
      guarantor_block: await this.buildLeaseGuaranteesBlock(leaseId, row),
      visale_block: this.buildVisaleBlock(row),

      rent_eur: this.toEuros(row.rent_cents),
      charges_eur: this.toEuros(row.charges_cents),
      deposit_eur: this.toEuros(row.deposit_cents),

      charges_clause_html: this.buildChargesClauseHtml(row),

      payment_day: String(row.payment_day ?? 5),

      // IRL
      irl_reference_quarter: this.escapeHtml(String(terms.irlIndexation?.referenceQuarter ?? irl.quarter)),
      irl_reference_value: this.escapeHtml(String(terms.irlIndexation?.referenceValue ?? irl.value)),
      // ✅ no irl_revision_date column -> use start_date
      irl_clause_html: this.buildIrlClauseHtml(row),

            // ✅ Lease terms (clauses) — source of truth
      terms_lease_type: this.escapeHtml(String(terms.leaseType)),

      terms_duration_months: String(terms.durationMonths ?? 12),
      terms_tacit_renewal: (terms.tacitRenewal ?? true) ? 'Oui' : 'Non',

      terms_notice_tenant_months: String(terms.noticeTenantMonths ?? 1),
      terms_notice_landlord_months: String(terms.noticeLandlordMonths ?? 3),

      terms_solidarity_clause: terms.solidarityClause ? 'Oui' : 'Non',

      terms_insurance_required: (terms.insuranceRequired ?? true) ? 'Oui' : 'Non',
      terms_subletting_allowed: (terms.sublettingAllowed ?? false) ? 'Oui' : 'Non',

      terms_pets_policy: this.escapeHtml(
        terms.petsPolicy === 'ALLOWED'
          ? 'Animaux autorisés'
          : terms.petsPolicy === 'FORBIDDEN'
          ? 'Animaux interdits'
          : 'Animaux non précisés'
      ),

      terms_irl_enabled: terms.irlIndexation?.enabled ? 'Oui' : 'Non',
      terms_irl_reference_quarter: this.escapeHtml(String(terms.irlIndexation?.referenceQuarter ?? '')),
      terms_irl_reference_value: this.escapeHtml(String(terms.irlIndexation?.referenceValue ?? '')),

      terms_special_clauses: this.escapeHtml(String(terms.specialClauses ?? '')),

      signature_city: this.escapeHtml(
        process.env.SIGNATURE_CITY ||
        (
          row.unit_city && /^\d{5}$/.test(row.unit_city)
            ? '' // si jamais city = 5 chiffres → on ignore
            : row.unit_city
        ) ||
        '—'
      ),
      signature_date: this.formatDateFr(new Date()),
    };

    // ----------------------
    // Guard bailleur “bloquant”
    // ----------------------
    const missing: string[] = [];
    const bad = (v?: string) => !v || v.includes('[À compléter]');

    if (bad(vars.landlord_name)) missing.push('landlord_name');
    if (bad(vars.landlord_address)) missing.push('landlord_address');
    if (bad(vars.landlord_email)) missing.push('landlord_email');
    if (bad(vars.landlord_phone)) missing.push('landlord_phone');

    if (missing.length) {
      throw new BadRequestException({
        message: 'Contract not ready: missing landlord information',
        missing,
      });
    }
    // 1) check template DB tel que lu par le code
    if (tpl.html_template.includes("Ã") || tpl.html_template.includes("Â")) {
      console.warn("[TPL ENCODING] template already mojibake");
    }

    // 2) génération html final
    const html = this.applyVars(tpl.html_template, vars);

    // 3) check html final
    if (html.includes("Ã") || html.includes("Â")) {
      console.warn("[HTML ENCODING] after applyVars mojibake");
    }

    const pdfBuf = await this.htmlToPdfBuffer(html);
    const outDir = path.join(this.storageBase, 'units', row.unit_id, 'leases', leaseId, 'documents');
    this.ensureDir(outDir);
    const outPdfPath = path.join(outDir, pdfName);
    fsSync.writeFileSync(outPdfPath, pdfBuf);

    const sha = this.sha256File(outPdfPath);

    const ins = await this.pool.query(
      `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
       VALUES ($1,$2,'CONTRAT',$3,$4,$5) RETURNING *`,
      [row.unit_id, leaseId, pdfName, outPdfPath.replace(this.storageBase, ''), sha],
    );


    return { created: true, document: ins.rows[0] };
  }


  async generateIrlAvenantPdf(leaseId: string, body?: { revisionDate?: string }, opts?: { force?: boolean }) {
  const force = !!opts?.force;
  if (!leaseId) throw new BadRequestException('Missing leaseId');

  // 1) récupérer révision (par date si fournie, sinon dernière)
  const revisionDateIso = body?.revisionDate ? String(body.revisionDate).slice(0, 10) : '';
  const rev =
    revisionDateIso
      ? await this.getLeaseRevisionByDate(leaseId, revisionDateIso)
      : await this.getLatestLeaseRevision(leaseId);

  if (!rev) {
    throw new BadRequestException('No IRL revision exists for this lease (lease_revisions empty)');
  }

  const row = await this.fetchLeaseBundle(leaseId);
  const landlord = await this.getLandlordForLease(leaseId);
  if (!landlord) {
    throw new BadRequestException({
      message: 'Avenant not ready: missing landlord information',
      missing: ['landlord_profile'],
    });
  }

  const leaseKind = String(row.kind || 'MEUBLE_RP').toUpperCase() as LeaseKind;

  // 2) filename stable (1 avenant par date de révision)
  const revIso = this.isoDate(rev.revision_date);
  const pdfName = `AVENANT_IRL_${leaseKind}_${row.unit_code}_${revIso}.pdf`;

  // ✅ idempotence
  const existing = await this.findExistingDocByFilename({
    leaseId,
    type: 'AVENANT_IRL',
    filename: pdfName,
    parentNullOnly: true,
  });
  if (existing && !force) return { created: false, document: existing };

  // si force et doc existe: purge (même logique que contrat)
  if (existing && force) {
    if (existing.signed_final_document_id) {
      throw new BadRequestException('Cannot force rebuild: avenant already finalized (SIGNED_FINAL exists)');
    }
    const sigQ = await this.pool.query(`SELECT 1 FROM signatures WHERE document_id=$1 LIMIT 1`, [existing.id]);
    if (sigQ.rowCount) {
      throw new BadRequestException('Cannot force rebuild: signatures already exist on this avenant');
    }
    const abs = this.absFromStoragePath(existing.storage_path);
    await this.deleteDocumentRow(existing.id);
    await this.safeUnlinkAbs(abs);
  }

  // 3) contenu
  const oldEur = (Number(rev.previous_rent_cents) / 100).toFixed(2);
  const newEur = (Number(rev.new_rent_cents) / 100).toFixed(2);

  const oldCents = Number(rev.previous_rent_cents ?? 0);
  const newCents = Number(rev.new_rent_cents ?? 0);

  const oldEurNum = oldCents / 100;
  const newEurNum = newCents / 100;

  const irlNew = Number(rev.irl_new_value ?? 0);
  const irlRef = Number(rev.irl_reference_value ?? 0);

  // formule affichée (lisible)
  const formulaDisplay =
    (oldEurNum && irlNew && irlRef)
      ? `${oldEurNum.toFixed(2)} € × (${irlNew} / ${irlRef}) = ${newEurNum.toFixed(2)} €`
      : String(rev.formula || '');  

  const landlord_identifiers_html = `
    <div><b>${this.escapeHtml(landlord.name)}</b></div>
    <div>${this.escapeHtml(landlord.address)}</div>
    <div>Email : ${this.escapeHtml(landlord.email)} — Tél : ${this.escapeHtml(landlord.phone)}</div>
  `.trim();

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.35}
h1{font-size:16pt;margin:0 0 10px 0}
.small{color:#555;font-size:10pt}
.box{border:1px solid #ddd;padding:10px;border-radius:8px;margin:10px 0}
.kv{width:100%;border-collapse:collapse}
.kv td{border:1px solid #eee;padding:8px;vertical-align:top}
.k{width:32%;background:#fafafa;font-weight:700}
</style></head>
<body>

<h1>Avenant — Révision du loyer (IRL)</h1>
<div class="small">Bail : ${this.escapeHtml(leaseId)} • Logement : ${this.escapeHtml(row.unit_code)}</div>

<div class="box">
  <b>Bailleur</b><br/>
  ${landlord_identifiers_html}
</div>

<div class="box">
  <b>Locataire(s)</b><br/>
  ${this.buildTenantsBlock(row)}
</div>

<div class="box">
  <table class="kv">
    <tr><td class="k">Date d'effet de la révision</td><td>${this.escapeHtml(this.formatDateFr(revIso))}</td></tr>
    <tr><td class="k">Ancien loyer (hors charges)</td><td><b>${this.escapeHtml(oldEur)} €</b></td></tr>
    <tr><td class="k">Nouveau loyer (hors charges)</td><td><b>${this.escapeHtml(newEur)} €</b></td></tr>
    <tr><td class="k">IRL de référence</td><td>${this.escapeHtml(String(rev.irl_reference_quarter || '—'))} — ${this.escapeHtml(String(rev.irl_reference_value || '—'))}</td></tr>
    <tr><td class="k">IRL appliqué</td><td>${this.escapeHtml(String(rev.irl_new_quarter || '—'))} — ${this.escapeHtml(String(rev.irl_new_value || '—'))}</td></tr>
    <tr>
      <td class="k">Formule</td>
      <td>${this.escapeHtml(formulaDisplay)}</td>
    </tr>
  </table>
</div>

<p>
Conformément à la clause d’indexation prévue au bail, le loyer est révisé selon l’indice de référence des loyers publié par l’INSEE.
</p>

<p class="small">
Le présent avenant prend effet à la date indiquée ci-dessus. Les autres clauses du bail demeurent inchangées.
</p>

<p class="small">
Fait à ${this.escapeHtml(process.env.SIGNATURE_CITY || row.unit_city || '—')}, le ${this.escapeHtml(this.formatDateFr(revIso))}.
</p>

</body></html>`;

  // 4) pdf -> storage -> DB
  const pdfBuf = await this.htmlToPdfBuffer(html);

  const outDir = path.join(this.storageBase, 'units', row.unit_id, 'leases', leaseId, 'documents');
  this.ensureDir(outDir);
  const outPdfPath = path.join(outDir, pdfName);
  fsSync.writeFileSync(outPdfPath, pdfBuf);

  const sha = this.sha256File(outPdfPath);

  const ins = await this.pool.query(
    `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
     VALUES ($1,$2,'AVENANT_IRL',$3,$4,$5) RETURNING *`,
    [row.unit_id, leaseId, pdfName, outPdfPath.replace(this.storageBase, ''), sha],
  );

  return { created: true, document: ins.rows[0] };
}

  // -------------------------------------
  // GUARANTEE picker (CAUTION) + UI helpers
  // -------------------------------------
  // ✅ Source de vérité : lease_guarantees (type='CAUTION', selected=true)
  // Règles :
  // - si guaranteeId fourni => 1 row (le plus robuste)
  // - sinon si leaseTenantId fourni => 1 row
  // - sinon si tenantId fourni => 1 row
  // - sinon si 1 seul candidat => OK
  // - sinon throw + candidates (UI-friendly)
  private async pickSelectedCautionGuarantee(params: {
    leaseId: string;
    guaranteeId?: string;
    leaseTenantId?: string;
    tenantId?: string;
  }) {
    const leaseId = String(params.leaseId || '').trim();
    const guaranteeId = params.guaranteeId ? String(params.guaranteeId).trim() : '';
    const leaseTenantId = params.leaseTenantId ? String(params.leaseTenantId).trim() : '';
    const tenantId = params.tenantId ? String(params.tenantId).trim() : '';

    if (!leaseId) throw new BadRequestException('Missing leaseId');

    // 0) guaranteeId fourni -> exact
    if (guaranteeId) {
      const q = await this.pool.query(
        `
        SELECT lg.*,
               lt.tenant_id,
               lt.role,
               t.full_name AS tenant_full_name,
               t.email AS tenant_email
        FROM lease_guarantees lg
        JOIN lease_tenants lt ON lt.id = lg.lease_tenant_id
        JOIN tenants t ON t.id = lt.tenant_id
        WHERE lg.lease_id = $1
          AND lg.id = $2
          AND lg.selected = true
          AND lg.type = 'CAUTION'
        LIMIT 1
        `,
        [leaseId, guaranteeId],
      );
      const row = q.rows?.[0];
      if (!row) throw new BadRequestException('Guarantee not found (or not selected/CAUTION)');
      return row;
    }

    // 1) leaseTenantId fourni -> exact
    if (leaseTenantId) {
      const q = await this.pool.query(
        `
        SELECT lg.*,
               lt.tenant_id,
               lt.role,
               t.full_name AS tenant_full_name,
               t.email AS tenant_email
        FROM lease_guarantees lg
        JOIN lease_tenants lt ON lt.id = lg.lease_tenant_id
        JOIN tenants t ON t.id = lt.tenant_id
        WHERE lg.lease_id = $1
          AND lg.lease_tenant_id = $2
          AND lg.selected = true
          AND lg.type = 'CAUTION'
        ORDER BY lg.created_at DESC
        LIMIT 1
        `,
        [leaseId, leaseTenantId],
      );
      return q.rows?.[0] || null;
    }

    // 2) tenantId fourni -> via lease_tenants
    if (tenantId) {
      const q = await this.pool.query(
        `
        SELECT lg.*,
               lt.tenant_id,
               lt.role,
               t.full_name AS tenant_full_name,
               t.email AS tenant_email
        FROM lease_guarantees lg
        JOIN lease_tenants lt ON lt.id = lg.lease_tenant_id
        JOIN tenants t ON t.id = lt.tenant_id
        WHERE lg.lease_id = $1
          AND lt.tenant_id = $2
          AND lg.selected = true
          AND lg.type = 'CAUTION'
        ORDER BY lg.created_at DESC
        LIMIT 1
        `,
        [leaseId, tenantId],
      );
      return q.rows?.[0] || null;
    }

    // 3) Sinon: tous les CAUTION sélectionnés
    const q = await this.pool.query(
      `
      SELECT lg.*,
             lt.tenant_id,
             lt.role,
             t.full_name AS tenant_full_name,
             t.email AS tenant_email
      FROM lease_guarantees lg
      JOIN lease_tenants lt ON lt.id = lg.lease_tenant_id
      JOIN tenants t ON t.id = lt.tenant_id
      WHERE lg.lease_id = $1
        AND lg.selected = true
        AND lg.type = 'CAUTION'
      ORDER BY CASE WHEN lt.role='principal' THEN 0 ELSE 1 END, lt.created_at ASC, lg.created_at ASC
      `,
      [leaseId],
    );

    if (!q.rows?.length) return null;
    if (q.rows.length === 1) return q.rows[0];

    const candidates = q.rows.map((r: any) => ({
      guaranteeId: r.id,
      leaseTenantId: r.lease_tenant_id,
      tenantId: r.tenant_id,
      tenantFullName: r.tenant_full_name,
      role: r.role,
      guarantorFullName: r.guarantor_full_name,
      guarantorEmail: r.guarantor_email,
    }));

    throw new BadRequestException({
      message:
        'Multiple guarantor guarantees found on this lease. Provide guaranteeId (preferred) or leaseTenantId or tenantId.',
      candidates,
    } as any);
  }

// -------------------------------------
// ACTE DE CAUTIONNEMENT (GUARANTOR_ACT)
// -------------------------------------
async generateGuarantorActPdf(
  leaseId: string,
  opts?: { guaranteeId?: string; leaseTenantId?: string; tenantId?: string },
) {
  const leaseIdTrim = String(leaseId || '').trim();
  if (!leaseIdTrim) throw new BadRequestException('Missing leaseId');

  // Charge le lease (inchangé)
  const leaseQ = await this.pool.query(
    `
    SELECT l.*,
           u.code AS unit_code,
           u.label AS unit_label,
           u.address_line1,
           u.city,
           u.postal_code,
           p.name AS project_name
    FROM leases l
    JOIN units u ON u.id = l.unit_id
    LEFT JOIN projects p ON p.id = u.project_id
    WHERE l.id = $1
    LIMIT 1
    `,
    [leaseIdTrim],
  );

  const lease = leaseQ.rows?.[0];
  if (!lease) throw new BadRequestException('Lease not found');


  // email pas forcément obligatoire pour signer sur place, donc on ne bloque pas ici.
  // (mais tu peux le rendre obligatoire si ton template le nécessite)
  //if (!leaseId) throw new BadRequestException('Missing leaseId');

  // ✅ Multi-garants: 1 acte par "caution sélectionnée" (scopée par lease_guarantees)
  const g = await this.pickSelectedCautionGuarantee({
    leaseId: leaseIdTrim,
    guaranteeId: opts?.guaranteeId,
    leaseTenantId: opts?.leaseTenantId,
    tenantId: opts?.tenantId,
  });

  // legacy: guarantors_json peut être string JSON en DB
  const legacyArr = this.parseJsonSafe(lease?.guarantors_json);
  const legacyOne = Array.isArray(legacyArr) ? legacyArr[0] : null;

  const guarantorFullName = String(
    g?.guarantor_full_name ?? lease?.guarantor_full_name ?? legacyOne?.full_name ?? ''
  ).trim();

  const guarantorEmail = String(
    g?.guarantor_email ?? lease?.guarantor_email ?? legacyOne?.email ?? ''
  ).trim();

  const guarantorPhone = String(
    g?.guarantor_phone ?? lease?.guarantor_phone ?? legacyOne?.phone ?? ''
  ).trim();

  const guarantorAddress = String(
    g?.guarantor_address ?? lease?.guarantor_address ?? legacyOne?.address ?? ''
  ).trim();

  if (!guarantorFullName) {
    throw new BadRequestException('No guarantor configured on this lease');
  }

  const rentCents = Number(lease?.rent_cents ?? 0);
  const chargesCents = Number(lease?.charges_cents ?? 0);

  const leaseTerms =
    typeof lease?.lease_terms === 'string'
      ? this.parseJsonSafe(lease.lease_terms)
      : lease?.lease_terms || {};

  const guaranteeDurationMonths = Number(leaseTerms?.durationMonths || 12);
  const guaranteeCapCents = (rentCents + chargesCents) * guaranteeDurationMonths;
  const guaranteeCapEur = this.toEuros(guaranteeCapCents);

  const row = await this.fetchLeaseBundle(leaseId);
  const landlord = await this.getLandlordForLease(leaseId);

  if (!landlord) {
    throw new BadRequestException({
      message: 'Guarantor act not ready: missing landlord information',
      missing: ['landlord_profile'],
    });
  }

  const leaseKind = String(row.kind || 'MEUBLE_RP').toUpperCase() as LeaseKind;
  if (leaseKind !== 'MEUBLE_RP' && leaseKind !== 'NU_RP' && leaseKind !== 'SAISONNIER') {
    throw new BadRequestException(`Unsupported lease kind for guarantor act: ${leaseKind}`);
  }

const gKey = String(g?.id || g?.lease_tenant_id || 'legacy').slice(0, 8);

// ✅ IDEMPOTENCE: filename stable par garant
const pdfName = `ACTE_CAUTION_${leaseKind}_${row.unit_code}_${this.isoDate(row.start_date)}_${gKey}.pdf`;
  
  const existing = await this.findExistingDocByFilename({
    leaseId,
    type: 'GUARANTOR_ACT',
    filename: pdfName,
    parentNullOnly: true,
  });

  // ✅ IMPORTANT: on "attache" toujours l'acte au guarantee (même en idempotence)
  if (existing) {
    const guaranteeId = String(g?.id || '').trim(); // g = lease_guarantees row
    if (guaranteeId) {
      await this.pool.query(
        `
        UPDATE lease_guarantees
        SET guarantor_act_document_id = $1
        WHERE id = $2
          AND lease_id = $3
          AND type = 'CAUTION'
          AND selected = true
        `,
        [existing.id, guaranteeId, leaseIdTrim],
      );
    }

    return { created: false, document: existing };
  }

  // ✅ On réutilise la version/template que tu utilises déjà
  const templateVersion = '2026-04';
  const tpl = await this.getTemplate('GUARANTOR_ACT', leaseKind, templateVersion);

  // ✅ Récupération garant (legacy + fallback guarantors_json)
  
  //}

  // ✅ Ici, on NE relit PAS row.guarantors_json : on utilise la sélection ci-dessus (g + fallback legacy lease)
  const guarantorName = guarantorFullName; 

  const landlord_identifiers_html = `
    <div><b>${this.escapeHtml(landlord.name)}</b></div>
    <div>${this.escapeHtml(landlord.address)}</div>
    <div>Email : ${this.escapeHtml(landlord.email)} — Tél : ${this.escapeHtml(landlord.phone)}</div>
  `.trim();

  // --- vars plain attendues par le template ---
  const designationSummary = `${row.unit_label || ''} (${row.unit_code || ''})`.trim();

  const tenantsArr = this.parseJsonSafe(row.tenants_json);
  const tenantsList: any[] = Array.isArray(tenantsArr) ? tenantsArr : [];

  const tenantsNamesPlain =
    tenantsList.length
      ? tenantsList.map((t) => String(t?.full_name || '').trim()).filter(Boolean).join(', ')
      : String(row.tenant_name || '').trim();

  const guaranteedTenantFullName = String(
    g?.tenant_full_name ??
    tenantsList.find((t) => String(t?.tenant_id || t?.id || '').trim() === String(g?.tenant_id || '').trim())?.full_name ??
    row.tenant_name ??
    ''
  ).trim();

  const landlordIdentifiersPlain = [
    String(landlord.name || '').trim(),
    String(landlord.address || '').trim(),
    `Email : ${String(landlord.email || '').trim()} — Tél : ${String(landlord.phone || '').trim()}`
  ]
    .filter(Boolean)
    .join('\n');

  const vars: Record<string, any> = {
    template_version: templateVersion,
    lease_id_short: this.leaseIdShort(leaseId),

    unit_code: this.escapeHtml(row.unit_code),
    unit_label: this.escapeHtml(row.unit_label),
    unit_address_line1: this.escapeHtml(row.unit_address_line1),
    unit_postal_code: this.escapeHtml(row.unit_postal_code),
    unit_city: this.escapeHtml(row.unit_city),

    start_date_fr: this.formatDateFr(row.start_date),
    end_date_theoretical: this.formatDateFr(row.end_date_theoretical),

    tenants_block: this.buildTenantsBlock(row),

    landlord_identifiers_html,
    landlord_name: this.escapeHtml(landlord.name),
    landlord_address: this.escapeHtml(landlord.address),
    landlord_email: this.escapeHtml(landlord.email),
    landlord_phone: this.escapeHtml(landlord.phone),
    designation_summary: this.escapeHtml(designationSummary || '—'),
    tenants_names_plain: this.escapeHtml(tenantsNamesPlain || '—'),
        guaranteed_tenant_full_name: this.escapeHtml(guaranteedTenantFullName || tenantsNamesPlain || '—'),
    landlord_identifiers_plain: this.escapeHtml(landlordIdentifiersPlain || '—'),
    start_date: this.formatDateFr(row.start_date),

    rent_eur: this.toEuros(row.rent_cents),
    charges_eur: this.toEuros(row.charges_cents),
    deposit_eur: this.toEuros(row.deposit_cents),

    guarantor_full_name: this.escapeHtml(guarantorName || '—'),
    guarantor_email: this.escapeHtml(guarantorEmail || '—'),
    guarantor_phone: this.escapeHtml(guarantorPhone || '—'),
    guarantor_address: this.escapeHtml(guarantorAddress || 'Adresse non renseignée'),
    guarantee_cap_eur: this.escapeHtml(guaranteeCapEur),
    guarantee_duration_months: this.escapeHtml(String(guaranteeDurationMonths)),
    guarantee_duration_label: this.escapeHtml(`${guaranteeDurationMonths} mois`),

    signature_city: this.escapeHtml(
        process.env.SIGNATURE_CITY ||
        (
          row.unit_city && /^\d{5}$/.test(row.unit_city)
            ? '' // si jamais city = 5 chiffres → on ignore
            : row.unit_city
        ) ||
        '—'
      ),
    signature_date: this.formatDateFr(new Date()),
  };

  const html = this.applyVars(tpl.html_template, vars);

  const pdfBuf = await this.htmlToPdfBuffer(html);
  const sha = this.sha256Buffer(pdfBuf);

  const outDir = path.join(this.storageBase, 'units', row.unit_id, 'leases', leaseId, 'documents');
  this.ensureDir(outDir);
  const outPdfPath = path.join(outDir, pdfName);
  fsSync.writeFileSync(outPdfPath, pdfBuf);

  const ins = await this.pool.query(
    `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
     VALUES ($1,$2,'GUARANTOR_ACT',$3,$4,$5) RETURNING *`,
    [row.unit_id, leaseId, pdfName, outPdfPath.replace(this.storageBase, ''), sha],
  );

  const createdDoc = ins.rows[0];

  // ✅ IMPORTANT: lier l'acte généré à la garantie sélectionnée
  // (sinon signature-status ne verra jamais actDocumentId)
  try {
    const guaranteeId = String(g?.id || '').trim(); // ou g?.guarantee_id selon ta query
    if (guaranteeId) {
      await this.pool.query(
        `
        UPDATE lease_guarantees
        SET guarantor_act_document_id = $1
        WHERE id = $2
          AND lease_id = $3
          AND type = 'CAUTION'
        `,
        [createdDoc.id, guaranteeId, leaseIdTrim],
      );
    }
  } catch (e) {
    console.warn('[GUARANTOR_ACT] failed to sync lease_guarantees.guarantor_act_document_id', e);
  }



  return { created: true, document: createdDoc };
}

  // ---------------------------------------------
  // NOTICE (RP only)
  // ---------------------------------------------
  async generateNoticePdf(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const row = await this.fetchLeaseBundle(leaseId);
    const landlord = await this.getLandlordForLease(leaseId);

    if (!landlord) {
      throw new BadRequestException({
        message: 'Contract not ready: missing landlord information',
        missing: ['landlord_profile'],
      });
    }

    const missing: string[] = [];
    const bad = (v?: string) => !v || String(v).trim().length === 0 || String(v).includes('[À compléter]');

    if (!landlord) {
      missing.push('landlord_profile');
    } else {
      if (bad(landlord.address)) missing.push('landlord_address');
      if (bad(landlord.email)) missing.push('landlord_email');
      if (bad(landlord.phone)) missing.push('landlord_phone');
      if (bad(landlord.name)) missing.push('landlord_name');
    }

    if (missing.length) {
      throw new BadRequestException({
        message: 'Notice not ready: missing landlord information',
        missing,
      });
    }

    const landlord_identifiers_html = `
    <div><b>${this.escapeHtml(landlord.name)}</b></div>
    <div>${this.escapeHtml(landlord.address)}</div>
    <div>Email : ${this.escapeHtml(landlord.email)} — Tél : ${this.escapeHtml(landlord.phone)}</div>
  `.trim();

    const leaseKind = String(row.kind || 'MEUBLE_RP').toUpperCase() as LeaseKind;

    if (leaseKind === 'SAISONNIER') {
      throw new BadRequestException('Notice is for residence principale only');
    }

    const title =
      leaseKind === 'NU_RP' ? 'Notice d’information — Location nue (RP)' : 'Notice d’information — Location meublée (RP)';

    const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.35}
h1{font-size:16pt;margin:0 0 10px 0}
.box{border:1px solid #ddd;padding:10px;margin:10px 0;border-radius:8px}
.small{color:#666;font-size:10pt}
</style></head>
<body>
<h1>${this.escapeHtml(title)}</h1>
<div class="box">
<b>Bail :</b> ${this.escapeHtml(leaseId)}<br/>
<b>Logement :</b> ${this.escapeHtml(row.unit_code)} — ${this.escapeHtml(row.unit_label)}<br/>
<b>Adresse :</b> ${this.escapeHtml(row.unit_address_line1)}, ${this.escapeHtml(row.unit_postal_code)} ${this.escapeHtml(row.unit_city)}<br/>
<b>Locataire(s) :</b> ${this.escapeHtml(this.buildTenantsPlainLabel(row))}<br/>
<b>Période :</b> ${this.formatDateFr(row.start_date)} → ${this.formatDateFr(row.end_date_theoretical)}
</div>

<div class="box">
<b>Informations essentielles</b>
<ul>
  <li>Type de location : <b>${this.escapeHtml(leaseKind)}</b> (résidence principale).</li>
  <li>Loyer : <b>${this.toEuros(row.rent_cents)} €</b> / mois.</li>
  <li>Charges : <b>${this.toEuros(row.charges_cents)} €</b>.</li>
  <li>Dépôt de garantie : <b>${this.toEuros(row.deposit_cents)} €</b>.</li>
</ul>
</div>

<p class="small">Document généré par RentalOS (version MVP).</p>
</body></html>`;

    // ✅ IDEMPOTENCE: if same notice already exists (same filename), return it.
    const pdfName = `NOTICE_${leaseKind}_${row.unit_code}_${this.isoDate(row.start_date)}.pdf`;
    const existing = await this.findExistingDocByFilename({
      leaseId,
      type: 'NOTICE',
      filename: pdfName,
      parentNullOnly: true,
    });
    if (existing) return { created: false, document: existing };

    const pdfBuf = await this.htmlToPdfBuffer(html);


    const outDir = path.join(this.storageBase, 'units', row.unit_id, 'leases', leaseId, 'documents');
    this.ensureDir(outDir);
    const outPdfPath = path.join(outDir, pdfName);
    fsSync.writeFileSync(outPdfPath, pdfBuf);

    const sha = this.sha256File(outPdfPath);

    const ins = await this.pool.query(
      `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
       VALUES ($1,$2,'NOTICE',$3,$4,$5) RETURNING *`,
      [row.unit_id, leaseId, pdfName, outPdfPath.replace(this.storageBase, ''), sha],
    );

    return { created: true, document: ins.rows[0] };
  }

  // ---------------------------------------------
  // EDL PDF (existing)
  // ---------------------------------------------
  async generateEdlPdf(
    leaseId: string,
    opts?: { phase: 'entry' | 'exit'; force?: boolean },
  ) {
    const phaseKey = opts?.phase;
    const force = Boolean(opts?.force);
    if (phaseKey !== 'entry' && phaseKey !== 'exit') {
      throw new BadRequestException("Invalid phase (expected 'entry'|'exit')");
    }
    const leaseQ = await this.pool.query(
      `SELECT l.*, u.id as unit_id, u.code as unit_code, u.label as unit_label, u.address_line1, u.city, u.postal_code,
              t.full_name as tenant_name
       FROM leases l
       JOIN units u ON u.id = l.unit_id
       JOIN tenants t ON t.id = l.tenant_id
       WHERE l.id=$1`,
      [leaseId],
    );
    if (!leaseQ.rowCount) throw new BadRequestException('Unknown leaseId');
    const lease = leaseQ.rows[0];


    this.assertUuidV4(leaseId, 'leaseId');

    const edlSession = await this.getLatestSessionByPhase({
      leaseId,
      table: 'edl_sessions',
      phase: phaseKey, // phaseKey vaut 'entry' | 'exit'
    });

    if (!edlSession) {
      throw new BadRequestException(`No EDL session for this lease in phase=${phaseKey}`);
    }

    const itemsQ = await this.pool.query(
      `SELECT id, section, label, entry_condition, entry_notes, exit_condition, exit_notes
       FROM edl_items
       WHERE edl_session_id=$1
       ORDER BY section, label`,
      [edlSession.id],
    );
    const items = itemsQ.rows;

    const photosQ = await this.pool.query(
      `SELECT p.id, p.edl_item_id, p.filename, p.mime_type, p.storage_path, p.created_at,
              i.section, i.label
      FROM edl_photos p
      JOIN edl_items i ON i.id = p.edl_item_id
      WHERE p.lease_id=$1
        AND i.edl_session_id=$2
      ORDER BY i.section, i.label, p.created_at ASC`,
      [leaseId, edlSession.id],
    );
    const photos = photosQ.rows;

    const photoMap = new Map<string, any[]>();
    for (const p of photos) {
      const arr = photoMap.get(p.edl_item_id) || [];
      arr.push(p);
      photoMap.set(p.edl_item_id, arr);
    }

    const phase = opts?.phase === 'exit' ? 'exit' : 'entry';
    const showExit = phase === 'exit';

    const rowsHtml = items
      .map((it: any) => {
        const cond = showExit ? (it.exit_condition ?? '') : (it.entry_condition ?? '');
        const notes = showExit ? (it.exit_notes ?? '') : (it.entry_notes ?? '');
        const photoCount = (photoMap.get(it.id) || []).length;

        return `<tr>
          <td class="sec">${this.escapeHtml(it.section)}</td>
          <td class="lab">${this.escapeHtml(it.label)}</td>
          <td class="cond">${this.escapeHtml(cond)}</td>
          <td class="notes">${this.escapeHtml(notes)}</td>
          <td class="pc">${photoCount}</td>
        </tr>`;
      })
      .join('\n');

    let annexHtml = '';
    if (photos.length > 0) {
      annexHtml += `<div class="pagebreak"></div><h2>Annexes — Photos</h2>`;
      let currentKey = '';
      for (const p of photos) {
        const key = `${p.section}||${p.label}`;
        if (key !== currentKey) {
          currentKey = key;
          annexHtml += `<div class="annex-item"><h3>${this.escapeHtml(p.section)} — ${this.escapeHtml(p.label)}</h3></div>`;
        }

        const candidates = [
          this.absFromStoragePath(p.storage_path),
          String(p.storage_path || ''),
          path.join(this.storageBase, String(p.storage_path || '').replace(/^\/+/, '')),
        ].filter(Boolean);

        let dataUrl = '';
        let foundPath = '';

        for (const candidate of candidates) {
          try {
            if (fsSync.existsSync(candidate)) {
              const buf = fsSync.readFileSync(candidate);
              dataUrl = `data:${p.mime_type || 'image/jpeg'};base64,${buf.toString('base64')}`;
              foundPath = candidate;
              break;
            }
          } catch {}
        }

        if (!dataUrl) {
          console.warn('[EDL PHOTO MISSING]', {
            photoId: p.id,
            filename: p.filename,
            storagePath: p.storage_path,
            candidates,
          });
        }

        annexHtml += `
          <div class="photo-block">
            <div class="photo-meta">${this.escapeHtml(p.filename)} • ${String(p.created_at).slice(0, 19)}</div>
            ${dataUrl ? `<img src="${dataUrl}" />` : `<div class="missing">Photo introuvable</div>`}
          </div>
        `;
      }
    }

    const leaseFullRow = await this.fetchLeaseBundle(leaseId);
    const tenantsPlainLabel = this.buildTenantsPlainLabel(leaseFullRow);
    const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
body{font-family:Arial,sans-serif;font-size:10.5pt;line-height:1.3}
h1{font-size:15pt;margin:0 0 6px 0}
h2{font-size:13.5pt;margin:12px 0 6px 0}
h3{font-size:12pt;margin:10px 0 6px 0}
.small{color:#666;font-size:9.5pt}
.box{border:1px solid #ddd;padding:10px;border-radius:8px;margin:10px 0}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ddd;padding:6px;vertical-align:top}
th{background:#f5f5f5}
.sec{width:12%}
.lab{width:14%}
.cond{width:10%}
.notes{width:21%}
.pc{width:6%; text-align:center}
.pagebreak{page-break-before: always;}
.photo-block{border:1px solid #eee;border-radius:8px;padding:8px;margin:8px 0}
.photo-meta{font-size:9pt;color:#666;margin-bottom:6px}
.photo-block img{max-width:100%;height:auto;border:1px solid #ddd;border-radius:6px}
.missing{color:#b00;font-size:10pt}
</style></head>
<body>
<h1>État des lieux (${phase === 'exit' ? 'Sortie' : 'Entrée'}) — ${this.escapeHtml(lease.unit_code)}</h1>
<div class="small">Bail: ${leaseId} • Session EDL: ${edlSession.id}</div>

<div class="box">
<b>Logement :</b> ${this.escapeHtml(lease.unit_label)} (${this.escapeHtml(lease.unit_code)})<br/>
${this.escapeHtml(lease.address_line1)}, ${this.escapeHtml(lease.postal_code)} ${this.escapeHtml(lease.city)}<br/>
<b>Locataire(s) :</b> ${this.escapeHtml(tenantsPlainLabel)}<br/>
<b>Période :</b> ${this.formatDateFr(lease.start_date)} → ${this.formatDateFr(lease.end_date_theoretical)}
</div>

<table>
  <thead>
    <tr>
      <th>Pièce</th>
      <th>Élément</th>
      <th>${phase === 'exit' ? 'Sortie — État' : 'Entrée — État'}</th>
      <th>${phase === 'exit' ? 'Sortie — Observations' : 'Entrée — Observations'}</th>
      <th>Photos</th>
    </tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
</table>

<p class="small">Document généré par RentalOS. Les photos sont ajoutées en annexe.</p>
${annexHtml}
</body></html>`;


    const phaseLabel = phaseKey === 'entry' ? 'ENTREE' : 'SORTIE';
    const docType: DocType = phaseKey === 'entry' ? 'EDL_ENTREE' : 'EDL_SORTIE';
  

    const pdfName = `EDL_${phaseLabel}_${lease.unit_code}_${this.isoDate(lease.start_date)}.pdf`;
    
    // ✅ IDEMPOTENCE + FORCE REBUILD (même logique que contrat)
    const existing = await this.findExistingDocByFilename({
      leaseId,
      type: docType,
      filename: pdfName,
      parentNullOnly: true,
    });

    if (existing) {
      if (!force) return { created: false, document: existing };

      // force === true
      if (existing.signed_final_document_id) {
        throw new BadRequestException('Cannot force rebuild: EDL already finalized (SIGNED_FINAL exists)');
      }

      const sigQ = await this.pool.query(
        `SELECT 1 FROM signatures WHERE document_id=$1 LIMIT 1`,
        [existing.id],
      );
      if (sigQ.rowCount) {
        throw new BadRequestException('Cannot force rebuild: signatures already exist on this EDL');
      }

      // purge DB + file
      const abs = this.absFromStoragePath(existing.storage_path);
      await this.deleteDocumentRow(existing.id);
      await this.safeUnlinkAbs(abs);
    }

    const outDir = path.join(this.storageBase, 'units', lease.unit_id, 'leases', leaseId, 'documents');
    this.ensureDir(outDir);
    const outPdfPath = path.join(outDir, pdfName);

    const pdfBuf = await this.htmlToPdfBuffer(html);
    fsSync.writeFileSync(outPdfPath, pdfBuf);

    const sha = this.sha256File(outPdfPath);

    const ins = await this.pool.query(
      `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        lease.unit_id,                                 // $1
        leaseId,                                       // $2
        docType,                                       // $3 ✅
        pdfName,                                       // $4
        outPdfPath.replace(this.storageBase, ''),      // $5
        sha,                                           // $6
      ],
    );

    return { created: true, document: ins.rows[0] };
  }

  // ---------------------------------------------
  // INVENTAIRE PDF (existing)
  // ---------------------------------------------
  async generateInventoryPdf(
    leaseId: string,
    opts?: { phase: 'entry' | 'exit'; force?: boolean },
  ) {
    const phase = opts?.phase;
    const force = Boolean(opts?.force);
    if (phase !== 'entry' && phase !== 'exit') {
      throw new BadRequestException("Invalid phase (expected 'entry'|'exit')");
    }
    const leaseQ = await this.pool.query(
      `SELECT l.*, u.id as unit_id, u.code as unit_code, u.label as unit_label, u.address_line1, u.city, u.postal_code,
              t.full_name as tenant_name
       FROM leases l
       JOIN units u ON u.id = l.unit_id
       JOIN tenants t ON t.id = l.tenant_id
       WHERE l.id=$1`,
      [leaseId],
    );
    if (!leaseQ.rowCount) throw new BadRequestException('Unknown leaseId');
    const lease = leaseQ.rows[0];

    // --------------------
    // PHASE (repère)
    // --------------------
    const phaseKey = phase;
    const phaseLabel = phaseKey === 'entry' ? 'ENTREE' : 'SORTIE';
    const showExit = phaseKey === 'exit';

    const docType: DocType =
      phaseKey === 'entry' ? 'INVENTAIRE_ENTREE' : 'INVENTAIRE_SORTIE';

    const pdfName = `INVENTAIRE_${phaseLabel}_${lease.unit_code}_${this.isoDate(lease.start_date)}.pdf`;

    this.assertUuidV4(leaseId, 'leaseId');

    const invSession = await this.getLatestSessionByPhase({
      leaseId,
      table: 'inventory_sessions',
      phase: phaseKey, // 'entry' | 'exit'
    });

    if (!invSession) {
      throw new BadRequestException(`No inventory session for this lease in phase=${phaseKey}`);
    }

    const linesQ = await this.pool.query(
      `SELECT
              il.id,
              c.category,
              c.name,
              il.entry_qty,
              il.entry_state,
              il.entry_notes,
              il.exit_qty,
              il.exit_state,
              il.exit_notes
      FROM inventory_lines il
      JOIN inventory_catalog_items c ON c.id = il.catalog_item_id
      WHERE il.inventory_session_id=$1
      ORDER BY c.category, c.name`,
      [invSession.id],
    );
    const lines = linesQ.rows;

    const photosQ = await this.pool.query(
      `SELECT
          p.id,
          p.inventory_line_id,
          p.filename,
          p.mime_type,
          p.storage_path,
          p.created_at,
          c.category,
          c.name
      FROM inventory_photos p
      JOIN inventory_lines il ON il.id = p.inventory_line_id
      JOIN inventory_catalog_items c ON c.id = il.catalog_item_id
      WHERE p.lease_id=$1
        AND il.inventory_session_id=$2
      ORDER BY c.category, c.name, p.created_at ASC`,
      [leaseId, invSession.id],
    );

    const photos = photosQ.rows;

    const photoMap = new Map<string, any[]>();
    for (const p of photos) {
      const arr = photoMap.get(p.inventory_line_id) || [];
      arr.push(p);
      photoMap.set(p.inventory_line_id, arr);
    }

    let currentCat = '';
    const rowsHtml = lines
      .map((ln: any) => {
        const cat = ln.category || 'Autre';
        const header =
          cat !== currentCat
            ? (() => {
                currentCat = cat;
                return `<tr class="catrow"><td colspan="5"><b>${this.escapeHtml(cat)}</b></td></tr>`;
              })()
            : '';
        const photoCount = (photoMap.get(ln.id) || []).length;

        return (
          header +
          `<tr>
            <td class="item">${this.escapeHtml(ln.name)}</td>
            <td class="qty">${showExit ? (ln.exit_qty ?? '') : (ln.entry_qty ?? '')}</td>
            <td class="state">${this.escapeHtml(showExit ? (ln.exit_state ?? '') : (ln.entry_state ?? ''))}</td>
            <td class="notes">${this.escapeHtml(showExit ? (ln.exit_notes ?? '') : (ln.entry_notes ?? ''))}</td>
            <td class="pc">${photoCount}</td>
          </tr>`
        );
      })
      .join('\n');

    let annexHtml = '';

    if (photos.length > 0) {
      annexHtml += `<div class="pagebreak"></div><h2>Annexes — Photos</h2>`;

      let currentKey = '';

      for (const p of photos) {
        const key = `${p.category}||${p.name}`;

        if (key !== currentKey) {
          currentKey = key;
          annexHtml += `<div class="annex-item"><h3>${this.escapeHtml(p.category)} — ${this.escapeHtml(p.name)}</h3></div>`;
        }

        const abs = String(p.storage_path || '');
        let dataUrl = '';

        try {
          const buf = fsSync.readFileSync(abs);
          dataUrl = `data:${p.mime_type || 'image/jpeg'};base64,${buf.toString('base64')}`;
        } catch {
          dataUrl = '';
        }

        annexHtml += `
          <div class="photo-block">
            <div class="photo-meta">${this.escapeHtml(p.filename)} • ${String(p.created_at).slice(0, 19)}</div>
            ${
              dataUrl
                ? `<img src="${dataUrl}" />`
                : `<div class="missing">Photo introuvable</div>`
            }
          </div>
        `;
      }
    }

    const leaseFullRow = await this.fetchLeaseBundle(leaseId);
    const tenantsPlainLabel = this.buildTenantsPlainLabel(leaseFullRow);  
    const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
body{font-family:Arial,sans-serif;font-size:10.5pt;line-height:1.3}
h1{font-size:15pt;margin:0 0 6px 0}
.small{color:#666;font-size:9.5pt}
.box{border:1px solid #ddd;padding:10px;border-radius:8px;margin:10px 0}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ddd;padding:6px;vertical-align:top}
th{background:#f5f5f5}
.catrow td{background:#fafafa}
h2{font-size:13.5pt;margin:12px 0 6px 0}
h3{font-size:12pt;margin:10px 0 6px 0}
.item{width:18%}
.qty{width:7%; text-align:center}
.state{width:10%}
.notes{width:24%}
.pc{width:6%; text-align:center}
.pagebreak{page-break-before: always;}
.photo-block{border:1px solid #eee;border-radius:8px;padding:8px;margin:8px 0}
.photo-meta{font-size:9pt;color:#666;margin-bottom:6px}
.photo-block img{max-width:100%;height:auto;border:1px solid #ddd;border-radius:6px}
.missing{color:#b00;font-size:10pt}
</style></head>
<body>
<h1>Inventaire ${phaseLabel === 'ENTREE' ? "d’entrée" : "de sortie"} — ${this.escapeHtml(lease.unit_code)}</h1>
<div class="small">Bail: ${leaseId} • Session Inventaire: ${invSession.id}</div>

<div class="box">
<b>Logement :</b> ${this.escapeHtml(lease.unit_label)} (${this.escapeHtml(lease.unit_code)})<br/>
${this.escapeHtml(lease.address_line1)}, ${this.escapeHtml(lease.postal_code)} ${this.escapeHtml(lease.city)}<br/>
<b>Locataire(s) :</b> ${this.escapeHtml(tenantsPlainLabel)}<br/>
<b>Période :</b> ${this.formatDateFr(lease.start_date)} → ${this.formatDateFr(lease.end_date_theoretical)}
</div>

<table>
  <thead>
    <tr>
      <th>Objet</th>
      <th>${phaseLabel} — Qté</th>
      <th>${phaseLabel} — État</th>
      <th>${phaseLabel} — Obs</th>
      <th>Photos</th>
    </tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
</table>

<p class="small">Document généré par RentalOS. Les photos sont ajoutées en annexe.</p>
${annexHtml}
</body></html>`;
    
    // ✅ IDEMPOTENCE + FORCE REBUILD (même logique que contrat)
    const existing = await this.findExistingDocByFilename({
      leaseId,
      type: docType,
      filename: pdfName,
      parentNullOnly: true,
    });

    if (existing) {
      if (!force) return { created: false, document: existing };

      // force === true
      if (existing.signed_final_document_id) {
        throw new BadRequestException('Cannot force rebuild: inventory already finalized (SIGNED_FINAL exists)');
      }

      const sigQ = await this.pool.query(
        `SELECT 1 FROM signatures WHERE document_id=$1 LIMIT 1`,
        [existing.id],
      );
      if (sigQ.rowCount) {
        throw new BadRequestException('Cannot force rebuild: signatures already exist on this inventory');
      }

      // purge DB + file
      const abs = this.absFromStoragePath(existing.storage_path);
      await this.deleteDocumentRow(existing.id);
      await this.safeUnlinkAbs(abs);
    }
    const outDir = path.join(this.storageBase, 'units', lease.unit_id, 'leases', leaseId, 'documents');
    this.ensureDir(outDir);
    const outPdfPath = path.join(outDir, pdfName);

    const pdfBuf = await this.htmlToPdfBuffer(html);
    fsSync.writeFileSync(outPdfPath, pdfBuf);

    const sha = this.sha256File(outPdfPath);

    const ins = await this.pool.query(
      `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        lease.unit_id,                                 // $1
        leaseId,                                       // $2
        docType,                                       // $3 ✅
        pdfName,                                       // $4
        outPdfPath.replace(this.storageBase, ''),      // $5
        sha,                                           // $6
      ],
    );

    return { created: true, document: ins.rows[0] };
  }

    async generateExitDocsBundle(
    leaseId: string,
    opts?: { force?: boolean },
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const force = Boolean(opts?.force);

    const edlRes = await this.generateEdlPdf(leaseId, {
      phase: 'exit',
      force,
    });

    const inventoryRes = await this.generateInventoryPdf(leaseId, {
      phase: 'exit',
      force,
    });

    return {
      created: true,
      leaseId,
      edl: edlRes.document,
      inventory: inventoryRes.document,
    };
  }

  async getPackFinalReadiness(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const row = await this.fetchLeaseBundle(leaseId);
    const leaseKind = String(row.kind || 'MEUBLE_RP').toUpperCase() as LeaseKind;
    const docs: any[] = await this.listDocsForLease(leaseId);

    const pickLatestDoc = (items: any[]) =>
      items
        .slice()
        .sort((a: any, b: any) =>
          String(b.created_at || '').localeCompare(String(a.created_at || '')),
        )[0] || null;

    const pickRootByType = (type: string) =>
      pickLatestDoc(
        docs.filter(
          (d: any) =>
            d.type === type &&
            !d.parent_document_id,
        ),
      );

    const resolveSignedFinalFromRoot = (rootDoc: any | null) => {
      if (!rootDoc) return null;

      if (rootDoc.signed_final_document_id) {
        return (
          docs.find((d: any) => String(d.id) === String(rootDoc.signed_final_document_id)) ||
          null
        );
      }

      return (
        docs.find(
          (d: any) =>
            String(d.parent_document_id || '') === String(rootDoc.id) &&
            String(d.filename || '').includes('_SIGNED_FINAL'),
        ) || null
      );
    };

    const contractSignedFinal =
      docs
        .filter((d: any) => d.type === 'CONTRAT')
        .filter((d: any) => d.parent_document_id || String(d.filename || '').includes('_SIGNED_FINAL'))
        .sort((a: any, b: any) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null;

    const guarantorActsSignedFinal = docs
      .filter((d: any) => d.type === 'GUARANTOR_ACT')
      .filter((d: any) => d.parent_document_id || String(d.filename || '').includes('_SIGNED_FINAL'))
      .sort((a: any, b: any) => {
        const fa = String(a.filename || '');
        const fb = String(b.filename || '');
        const c = fa.localeCompare(fb);
        if (c !== 0) return c;
        return String(a.created_at || '').localeCompare(String(b.created_at || ''));
      });

    const noticeRoot = pickRootByType('NOTICE');

    const edlRootEntry = pickRootByType('EDL_ENTREE');
    const inventaireRootEntry = pickRootByType('INVENTAIRE_ENTREE');

    const edlRootExit = pickRootByType('EDL_SORTIE');
    const inventaireRootExit = pickRootByType('INVENTAIRE_SORTIE');

    const edlRoot = edlRootEntry || edlRootExit || null;
    const inventaireRoot = inventaireRootEntry || inventaireRootExit || null;

    const edlSignedFinal = resolveSignedFinalFromRoot(edlRoot);
    const inventaireSignedFinal = resolveSignedFinalFromRoot(inventaireRoot);

    const notice = noticeRoot || null;
    const edl = edlSignedFinal || null;
    const inventaire = inventaireSignedFinal || null;

    const issues: string[] = [];

    if (!contractSignedFinal) {
      issues.push('CONTRACT_SIGNED_FINAL_MISSING');
    }

    if (leaseKind === 'MEUBLE_RP') {
      if (!notice) {
        issues.push('NOTICE_MISSING');
      }

      if (!edl) {
        issues.push(edlRoot ? 'EDL_SIGNED_FINAL_MISSING' : 'EDL_MISSING');
      }

      if (!inventaire) {
        issues.push(inventaireRoot ? 'INVENTAIRE_SIGNED_FINAL_MISSING' : 'INVENTAIRE_MISSING');
      }
    }

    return {
      ready: issues.length === 0,
      leaseId,
      leaseKind,
      issues,
      selected: {
        contractSignedFinal: contractSignedFinal
          ? { id: contractSignedFinal.id, filename: contractSignedFinal.filename, type: contractSignedFinal.type }
          : null,
        guarantorActsSignedFinal: guarantorActsSignedFinal.map((d: any) => ({
          id: d.id,
          filename: d.filename,
          type: d.type,
          parent_document_id: d.parent_document_id,
        })),
        notice: notice
          ? { id: notice.id, filename: notice.filename, type: notice.type }
          : null,
        edlRoot: edlRoot
          ? { id: edlRoot.id, filename: edlRoot.filename, type: edlRoot.type }
          : null,
        edlSignedFinal: edl
          ? { id: edl.id, filename: edl.filename, type: edl.type, parent_document_id: edl.parent_document_id }
          : null,
        inventaireRoot: inventaireRoot
          ? { id: inventaireRoot.id, filename: inventaireRoot.filename, type: inventaireRoot.type }
          : null,
        inventaireSignedFinal: inventaire
          ? { id: inventaire.id, filename: inventaire.filename, type: inventaire.type, parent_document_id: inventaire.parent_document_id }
          : null,
      },
      availableDocs: this.summarizeDocsForDebug(docs),
    };
  }  

  async generatePackFinalV2(leaseId: string, opts?: { force?: boolean }, parentDocumentId?: string) {
 
  console.log('[PACK_FINAL_V2 ENTER]', {
    leaseId,
    force: !!opts?.force,
  });

  const force = !!opts?.force;
  const row = await this.fetchLeaseBundle(leaseId);
  const leaseKind = String(row.kind || 'MEUBLE_RP').toUpperCase() as LeaseKind;

  const docs: any [] = await this.listDocsForLease(leaseId);

  const readiness = await this.getPackFinalReadiness(leaseId);

  console.log('[PACK_FINAL_V2 READINESS]', readiness);

  if (!readiness.ready) {
    throw new BadRequestException({
      message: 'PACK_FINAL_V2 impossible : dossier incomplet pour génération du pack final.',
      readiness,
    } as any);
  }

  console.log(
    '[PACK_FINAL_V2 DOCS]',
    docs.map((d: any) => ({
      id: d.id,
      type: d.type,
      filename: d.filename,
      parent_document_id: d.parent_document_id,
      signed_final_document_id: d.signed_final_document_id,
    })),
  );

  // 1) CONTRAT signé final (obligatoire)
  const contractSignedFinal =
    docs
      .filter((d: any) => d.type === 'CONTRAT')
      .filter((d: any) => d.parent_document_id || String(d.filename || '').includes('_SIGNED_FINAL'))
      .sort((a: any, b: any) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null;

  if (!contractSignedFinal) {
    throw new BadRequestException({
      message: 'PACK_FINAL_V2 impossible : contrat SIGNED_FINAL introuvable.',
      readiness,
    } as any);
  }

  const contractRootId = contractSignedFinal.parent_document_id || contractSignedFinal.id;

  const sigQ = await this.pool.query(
    `SELECT * FROM signatures WHERE document_id=$1 ORDER BY sequence ASC`,
    [contractRootId],
  );

  const contractSignatures = sigQ.rows || [];

  // 2) ACTES DE CAUTION signés final (multi, optionnels)
  const guarantorActsSignedFinal = docs
    .filter((d: any) => d.type === 'GUARANTOR_ACT')
    // on ne veut que les SIGNED_FINAL (parent_document_id != null) ou *_SIGNED_FINAL
    .filter((d: any) => d.parent_document_id || String(d.filename || '').includes('_SIGNED_FINAL'))
    // ordre stable (sinon pack “bouge” au fil des signatures)
    .sort((a: any, b: any) => {
      // tri par filename (stable et déterministe) puis created_at
      const fa = String(a.filename || '');
      const fb = String(b.filename || '');
      const c = fa.localeCompare(fb);
      if (c !== 0) return c;
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });

  // 3) Annexes documentaires
  // Règle stricte :
  // - NOTICE : document racine accepté (non signée)
  // - EDL / INVENTAIRE : uniquement SIGNED_FINAL
  const pickLatestDoc = (items: any[]) =>
    items
      .slice()
      .sort((a: any, b: any) =>
        String(b.created_at || '').localeCompare(String(a.created_at || '')),
      )[0] || null;

  const pickRootByType = (type: string) =>
    pickLatestDoc(
      docs.filter(
        (d: any) =>
          d.type === type &&
          !d.parent_document_id,
      ),
    );

  const resolveSignedFinalFromRoot = (rootDoc: any | null) => {
    if (!rootDoc) return null;

    if (rootDoc.signed_final_document_id) {
      return (
        docs.find((d: any) => String(d.id) === String(rootDoc.signed_final_document_id)) ||
        null
      );
    }

    return (
      docs.find(
        (d: any) =>
          String(d.parent_document_id || '') === String(rootDoc.id) &&
          String(d.filename || '').includes('_SIGNED_FINAL'),
      ) || null
    );
  };

  const noticeRoot = pickRootByType('NOTICE');

  const edlRootEntry = pickRootByType('EDL_ENTREE');
  const inventaireRootEntry = pickRootByType('INVENTAIRE_ENTREE');

  const edlRootExit = pickRootByType('EDL_SORTIE');
  const inventaireRootExit = pickRootByType('INVENTAIRE_SORTIE');

  const edlRoot = edlRootEntry || edlRootExit || null;
  const inventaireRoot = inventaireRootEntry || inventaireRootExit || null;

  const edlSignedFinal = resolveSignedFinalFromRoot(edlRoot);
  const inventaireSignedFinal = resolveSignedFinalFromRoot(inventaireRoot);

  const notice = noticeRoot || null;
  const edl = edlSignedFinal || null;
  const inventaire = inventaireSignedFinal || null;


  // Sécurité juridique :
  // le pack final ne doit jamais embarquer un EDL ou un inventaire racine non signé.
  // Si le document existe mais que son SIGNED_FINAL n'existe pas encore,
  // on bloque explicitement la génération du pack.
  if (leaseKind === 'MEUBLE_RP') {
    if (!notice) {
      throw new BadRequestException({
        message: 'PACK_FINAL_V2 impossible : notice introuvable pour un bail meublé RP.',
        selected: {
          notice: null,
          edl: edl ? { id: edl.id, filename: edl.filename, type: edl.type } : null,
          inventaire: inventaire ? { id: inventaire.id, filename: inventaire.filename, type: inventaire.type } : null,
        },
        availableDocs: this.summarizeDocsForDebug(docs),
      } as any);
    }

    if (!edl) {
      throw new BadRequestException({
        message: edlRoot
          ? 'PACK_FINAL_V2 impossible : EDL présent mais SIGNED_FINAL introuvable.'
          : 'PACK_FINAL_V2 impossible : EDL introuvable pour un bail meublé RP.',
        selected: {
          notice: notice ? { id: notice.id, filename: notice.filename, type: notice.type } : null,
          edlRoot: edlRoot ? { id: edlRoot.id, filename: edlRoot.filename, type: edlRoot.type } : null,
          edlSignedFinal: null,
          inventaire: inventaire ? { id: inventaire.id, filename: inventaire.filename, type: inventaire.type } : null,
        },
        availableDocs: this.summarizeDocsForDebug(docs),
      } as any);
    }

    if (!inventaire) {
      throw new BadRequestException({
        message: inventaireRoot
          ? 'PACK_FINAL_V2 impossible : inventaire présent mais SIGNED_FINAL introuvable.'
          : 'PACK_FINAL_V2 impossible : inventaire introuvable pour un bail meublé RP.',
        selected: {
          notice: notice ? { id: notice.id, filename: notice.filename, type: notice.type } : null,
          edl: edl ? { id: edl.id, filename: edl.filename, type: edl.type } : null,
          inventaireRoot: inventaireRoot ? { id: inventaireRoot.id, filename: inventaireRoot.filename, type: inventaireRoot.type } : null,
          inventaireSignedFinal: null,
        },
        availableDocs: this.summarizeDocsForDebug(docs),
      } as any);
    }
  }

  console.log('[PACK_FINAL_V2 SELECTED]', {
    contractSignedFinal: contractSignedFinal
      ? { id: contractSignedFinal.id, type: contractSignedFinal.type, filename: contractSignedFinal.filename }
      : null,
    guarantorActsSignedFinal: guarantorActsSignedFinal.map((d: any) => ({
      id: d.id,
      type: d.type,
      filename: d.filename,
      parent_document_id: d.parent_document_id,
    })),
    notice: notice
      ? { id: notice.id, type: notice.type, filename: notice.filename }
      : null,
    edlRoot: edlRoot
      ? { id: edlRoot.id, type: edlRoot.type, filename: edlRoot.filename }
      : null,
    edlSignedFinal: edl
      ? { id: edl.id, type: edl.type, filename: edl.filename, parent_document_id: edl.parent_document_id }
      : null,
    inventaireRoot: inventaireRoot
      ? { id: inventaireRoot.id, type: inventaireRoot.type, filename: inventaireRoot.filename }
      : null,
    inventaireSignedFinal: inventaire
      ? { id: inventaire.id, type: inventaire.type, filename: inventaire.filename, parent_document_id: inventaire.parent_document_id }
      : null,
  });

  // 4) AUDIT GLOBAL DU PACK
  const auditEntries = (
    await Promise.all([
      this.getAuditEntryForSignedDocument(contractSignedFinal),
      ...guarantorActsSignedFinal.map((act: any) =>
        this.getAuditEntryForSignedDocument(act),
      ),
      ...(edl ? [this.getAuditEntryForSignedDocument(edl)] : []),
      ...(inventaire ? [this.getAuditEntryForSignedDocument(inventaire)] : []),
    ])
  ).filter(Boolean) as Array<{
    id: string;
    type: string;
    filename?: string | null;
    originalSha256?: string | null;
    signedSha256?: string | null;
    signatures?: Array<{
      role: string;
      name: string;
      signedAt: string;
      ip?: string;
      userAgent?: string;
      consent?: boolean;
    }>;
  }>;

  const auditPdfBuffer = await this.buildPackAuditPdf(auditEntries); 

  const auditFilename = `AUDIT_PACK_FINAL_${String(leaseId).slice(0, 8)}.pdf`;
  const auditStoragePath = path.join(
    'units',
    String(row.unit_id),
    'leases',
    String(leaseId),
    'documents',
    auditFilename,
  );
  const auditAbs = this.absFromStoragePath(auditStoragePath);
  await fs.mkdir(path.dirname(auditAbs), { recursive: true });
  await fs.writeFile(auditAbs, auditPdfBuffer);


  // 5) Filename stable v2
  const packV2Name = `PACK_FINAL_V2_${leaseKind}_${row.unit_code}_${this.isoDate(row.start_date)}.pdf`;

  // 6) Delete + recreate (anti-idempotence “qui bloque”)
  const existing = await this.findExistingDocByFilename({
    leaseId,
    type: 'PACK_FINAL',
    filename: packV2Name,
    parentNullOnly: false,
  });

  if (existing && !force) {
    return {
      created: false,
      document: existing,
      debug: {
        reusedExisting: true,
        reason:
          'Un PACK_FINAL existant a été réutilisé car force=false. Si les annexes ont changé, il faut régénérer avec force=true.',
        selected: {
          contractSignedFinalId: contractSignedFinal?.id || null,
          edlId: edl?.id || null,
          inventaireId: inventaire?.id || null,
          noticeId: notice?.id || null,
          guarantorActsSignedFinalIds: guarantorActsSignedFinal.map((x: any) => x?.id).filter(Boolean),
        },
      },
    };
  }

  // si force=true, on supprime puis on régénère
  if (existing && force) {
    try {
      const abs = this.absFromStoragePath(existing.storage_path);
      if (fsSync.existsSync(abs)) fsSync.unlinkSync(abs);
    } catch {}
    await this.pool.query(`DELETE FROM documents WHERE id=$1`, [existing.id]);
  }

  // 7) Merge (via Gotenberg, plus robuste)
  const ordered: Array<{ n: string; doc: any }> = [];

  // 01 contrat
  ordered.push({ n: '01_CONTRAT_SIGNED_FINAL.pdf', doc: contractSignedFinal });

  // 02.. actes caution signés (multi)
  guarantorActsSignedFinal.forEach((act: any, idx: number) => {
    const num = String(2 + idx).padStart(2, '0');
    ordered.push({ n: `${num}_ACTE_CAUTION_SIGNED_FINAL_${idx + 1}.pdf`, doc: act });
  });

  // ensuite on continue avec notice/edl/inventaire en respectant la numérotation dynamique
  let next = 2 + guarantorActsSignedFinal.length;

  if (notice) {
    next += 1;
    ordered.push({ n: `${String(next).padStart(2, '0')}_NOTICE.pdf`, doc: notice });
  }
  if (edl) {
    next += 1;
    ordered.push({ n: `${String(next).padStart(2, '0')}_EDL.pdf`, doc: edl });
  }
  if (inventaire) {
    next += 1;
    ordered.push({ n: `${String(next).padStart(2, '0')}_INVENTAIRE.pdf`, doc: inventaire });
  }

  const parts = ordered
    .map(({ n, doc }) => {
      const p = this.safeReadPdfPart(doc); // lit buffer depuis storage_path
      return p ? { filename: n, buffer: p.buffer } : null; // ⚠️ override filename
    })
    .filter(Boolean) as Array<{ filename: string; buffer: Buffer }>;


  console.log('[PACK_FINAL_V2 DEBUG]', {
    leaseId,
    force,
    selected: {
      contractSignedFinal: contractSignedFinal
        ? {
            id: contractSignedFinal.id,
            type: contractSignedFinal.type,
            filename: contractSignedFinal.filename,
          }
        : null,
      notice: notice
        ? {
            id: notice.id,
            type: notice.type,
            filename: notice.filename,
          }
        : null,
      edl: edl
        ? {
            id: edl.id,
            type: edl.type,
            filename: edl.filename,
          }
        : null,
      inventaire: inventaire
        ? {
            id: inventaire.id,
            type: inventaire.type,
            filename: inventaire.filename,
          }
        : null,
      guarantorActsSignedFinal: guarantorActsSignedFinal.map((x: any) => ({
        id: x?.id || null,
        type: x?.type || null,
        filename: x?.filename || null,
      })),
    },
    ordered: ordered.map((x: any) => ({
      filename: x.n,
      docId: x.doc?.id || null,
      docType: x.doc?.type || null,
      docFilename: x.doc?.filename || null,
    })),
    parts: this.summarizeParts(parts),
  });



  if (leaseKind === 'MEUBLE_RP') {
  const hasNoticePart = parts.some((p) => p.filename.includes('_NOTICE.pdf'));
  const hasEdlPart = parts.some((p) => p.filename.includes('_EDL.pdf'));
  const hasInventairePart = parts.some((p) => p.filename.includes('_INVENTAIRE.pdf'));

  if (!hasNoticePart || !hasEdlPart || !hasInventairePart) {
    throw new BadRequestException({
      message: 'PACK_FINAL_V2 impossible : annexes meublé manquantes dans le merge.',
      expected: {
        notice: true,
        edl: true,
        inventaire: true,
      },
      actualParts: this.summarizeParts(parts),
      selected: {
        notice: notice ? { id: notice.id, filename: notice.filename, type: notice.type } : null,
        edl: edl ? { id: edl.id, filename: edl.filename, type: edl.type } : null,
        inventaire: inventaire ? { id: inventaire.id, filename: inventaire.filename, type: inventaire.type } : null,
      },
    } as any);
  }
}
  

  // 🔐 AUDIT ajouté ici
  const auditPart = this.safeReadPdfPartByFilename(
    '99_AUDIT_JOURNAL_SIGNATURE.pdf',
    auditPdfBuffer
  );

  if (auditPart) {
    parts.push(auditPart);
  }

  let mergedBuf: Buffer;
  try {
    mergedBuf = await this.mergePdfsGotenberg(parts);
  } catch (e) {
    console.error('[PACK MERGE ERROR]', {
      leaseId,
      parts: this.summarizeParts(parts),
      error: e,
    });
    throw e;
  }

  const packSha256 = this.sha256Buffer(mergedBuf);

  const packStoragePath = path.join(
    'units',
    String(row.unit_id),
    'leases',
    String(leaseId),
    'documents',
    packV2Name,
  );
  const packAbs = this.absFromStoragePath(packStoragePath);

  await fs.mkdir(path.dirname(packAbs), { recursive: true });
  await fs.writeFile(packAbs, mergedBuf);

  const packParentId = String(contractRootId || '') || null;

  // ✅ FIX BLOQUANT: placeholders + ordre des valeurs (sha256 puis parent_document_id)
  const ins = await this.pool.query(
    `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256, parent_document_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *`,
    [
      row.unit_id,       // $1
      leaseId,           // $2
      'PACK_FINAL',      // $3
      packV2Name,        // $4
      packStoragePath,   // $5
      packSha256,        // $6
      packParentId,      // $7
    ],
  );

  return { created: true, document: ins.rows[0] };
}


  // ---------------------------------------------
  // PACK PDF = merge (Contract + Notice if RP + EDL + Inventory)
  // ---------------------------------------------
  async generatePackPdf(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const row = await this.fetchLeaseBundle(leaseId);
    const leaseKind = String(row.kind || 'MEUBLE_RP').toUpperCase() as LeaseKind;

    // ✅ IDEMPOTENCE: if same pack already exists (same filename), return it.
    const packName = `PACK_${leaseKind}_${row.unit_code}_${this.isoDate(row.start_date)}.pdf`;
    const existing = await this.findExistingDocByFilename({
      leaseId,
      type: 'PACK',
      filename: packName,
      parentNullOnly: true,
    });
    if (existing) return { created: false, document: existing };

    const pdfName = packName; // ✅ AJOUTE ÇA

    const contractRes = await this.generateContractPdf(leaseId);

    let notice: any = null;
    if (leaseKind !== 'SAISONNIER') {
      notice = await this.generateNoticePdf(leaseId);
    }

    const edlRes = await this.generateEdlPdf(leaseId, { phase: 'entry' });
    const invRes = await this.generateInventoryPdf(leaseId, { phase: 'entry' });

    // ----- Variables du template 2026-03 -----
    const signature_date_fr = this.formatDateFr(new Date());
    const signature_place =
      row.unit_city && /^\d{5}$/.test(String(row.unit_city).trim()) ? '' : row.unit_city;
    const lease_start_date_fr = this.formatDateFr(row.start_date);
    const lease_end_date_fr = this.formatDateFr(row.end_date_theoretical);

    // Durée du bail
    const lease_duration_label = '1 an'; // ou calcul dynamique si nécessaire

    // Annexes HTML
    let annexes_list_html = '<ul>';
    if (contractRes) annexes_list_html += `<li>Contrat</li>`;
    if (notice) annexes_list_html += `<li>Avis</li>`;
    if (edlRes) annexes_list_html += `<li>État des lieux</li>`;
    if (invRes) annexes_list_html += `<li>Inventaire</li>`;
    annexes_list_html += '</ul>';

    const parts: Array<{ filename: string; buffer: Buffer }> = [];

    // ordre: contrat -> notice (si RP) -> edl -> inventaire
    const pContract = this.safeReadPdfPart(contractRes?.document);
    if (pContract) parts.push(pContract);

    const pNotice = notice ? this.safeReadPdfPart(notice?.document) : null;
    if (pNotice) parts.push(pNotice);

    const pEdl = this.safeReadPdfPart(edlRes?.document);
    if (pEdl) parts.push(pEdl);

    const pInv = this.safeReadPdfPart(invRes?.document);
    if (pInv) parts.push(pInv);

    if (!parts.length) {
      throw new BadRequestException('PACK: no PDFs found to merge');
    }

    // Création du HTML d'info avec tes variables (que tu as déjà calculées plus haut)
    const infoHtml = `
    <html><head><style>body { font-family: Arial; font-size: 10pt; }</style></head><body>
      <h2>Informations du pack</h2>
      <p>Date de signature : ${signature_date_fr}</p>
      <p>Lieu de signature : ${this.escapeHtml(signature_place)}</p>
      <p>Période du bail : ${lease_start_date_fr} → ${lease_end_date_fr}</p>
      <p>Durée du bail : ${lease_duration_label}</p>
      <p>Annexes incluses :</p>
      ${annexes_list_html}
    </body></html>`;

    // Génération du PDF buffer à partir de ce HTML
    const infoPdfBuf = await this.htmlToPdfBuffer(infoHtml);

    // Injection dans la liste des fichiers à fusionner
    parts.unshift({ filename: 'info_pack.pdf', buffer: infoPdfBuf });

    let mergedBuf: Buffer;
    try {
      mergedBuf = await this.mergePdfsGotenberg(parts);
    } catch (e) {
      console.error('[PACK MERGE ERROR]', {
        leaseId,
        parts: this.summarizeParts(parts),
        error: e,
      });
      throw e;
    }
    const mergedSha = this.sha256Buffer(mergedBuf);

    const outDir = path.join(this.storageBase, 'units', row.unit_id, 'leases', leaseId, 'documents');
    this.ensureDir(outDir);
    const outPdfPath = path.join(outDir, pdfName);
    fsSync.writeFileSync(outPdfPath, mergedBuf);


    const ins = await this.pool.query(
      `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
       VALUES ($1,$2,'PACK',$3,$4,$5) RETURNING *`,
      [row.unit_id, leaseId, pdfName, outPdfPath.replace(this.storageBase, ''), mergedSha],
    );
    

    return { created: true, document: ins.rows[0] };
  }


  // ---------------------------------------------
// PACK EDL+INV (Entrée/Sortie) = merge (EDL + Inventory)
// ---------------------------------------------
  async generatePackEdlInvPdf(
    leaseId: string,
    opts?: { phase: 'entry' | 'exit'; force?: boolean },
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const phase = opts?.phase;
    const force = Boolean(opts?.force);
    if (phase !== 'entry' && phase !== 'exit') {
      throw new BadRequestException("Invalid phase (expected 'entry'|'exit')");
    }

    const row = await this.fetchLeaseBundle(leaseId);

    const phaseLabel = phase === 'entry' ? 'ENTREE' : 'SORTIE';
    const docType: DocType = phase === 'entry' ? 'PACK_EDL_INV_ENTREE' : 'PACK_EDL_INV_SORTIE';

    // ✅ IDEMPOTENCE: if same pack already exists (same filename), return it (unless force)
    const packName = `PACK_EDL_INV_${phaseLabel}_${row.unit_code}_${this.isoDate(row.start_date)}.pdf`;
    const existing = await this.findExistingDocByFilename({
      leaseId,
      type: docType,
      filename: packName,
      parentNullOnly: true,
    });

    if (existing && !force) return { created: false, document: existing };

    // if already finalized, refuse rebuild even with force (same logic as contract/avenant)
    if (existing?.signed_final_document_id) {
      throw new BadRequestException('Cannot force rebuild: pack already finalized (SIGNED_FINAL exists)');
    }

    // Ensure EDL + Inventory docs exist for this phase
    // Reco: auto-generate if missing (smooth UX)
    const edlRes = await this.generateEdlPdf(leaseId, { phase, force });
    const invRes = await this.generateInventoryPdf(leaseId, { phase, force });

    // ----- Variables template (reuse pack style) -----
    const signature_date_fr = this.formatDateFr(new Date());
    const signature_place =
      row.unit_city && /^\d{5}$/.test(String(row.unit_city).trim()) ? '' : row.unit_city;

    const lease_start_date_fr = this.formatDateFr(row.start_date);
    const lease_end_date_fr = this.formatDateFr(row.end_date_theoretical);

    let annexes_list_html = '<ul>';
    if (edlRes) annexes_list_html += `<li>État des lieux (${phaseLabel.toLowerCase()})</li>`;
    if (invRes) annexes_list_html += `<li>Inventaire (${phaseLabel.toLowerCase()})</li>`;
    annexes_list_html += '</ul>';

    const parts: Array<{ filename: string; buffer: Buffer }> = [];

    const pEdl = this.safeReadPdfPart(edlRes?.document);
    if (pEdl) parts.push({ filename: `01_EDL_${phaseLabel}.pdf`, buffer: pEdl.buffer });

    const pInv = this.safeReadPdfPart(invRes?.document);
    if (pInv) parts.push({ filename: `02_INVENTAIRE_${phaseLabel}.pdf`, buffer: pInv.buffer });

    if (!parts.length) {
      throw new BadRequestException('PACK_EDL_INV: no PDFs found to merge');
    }

    const infoHtml = `
    <html><head><style>body { font-family: Arial; font-size: 10pt; }</style></head><body>
      <h2>Pack EDL + Inventaire (${this.escapeHtml(phaseLabel)})</h2>
      <p>Date : ${signature_date_fr}</p>
      <p>Lieu : ${this.escapeHtml(signature_place || '')}</p>
      <p>Bail : ${lease_start_date_fr} → ${lease_end_date_fr}</p>
      <p>Annexes incluses :</p>
      ${annexes_list_html}
    </body></html>`;

    const infoPdfBuf = await this.htmlToPdfBuffer(infoHtml);
    parts.unshift({ filename: 'info_pack_edl_inv.pdf', buffer: infoPdfBuf });

    let mergedBuf: Buffer;
    try {
      mergedBuf = await this.mergePdfsGotenberg(parts);
    } catch (e) {
      console.error('[PACK_EDL_INV MERGE ERROR]', {
        leaseId,
        phase,
        parts: this.summarizeParts(parts),
        error: e,
      });
      throw e;
    }

    const mergedSha = this.sha256Buffer(mergedBuf);

    const outDir = path.join(this.storageBase, 'units', row.unit_id, 'leases', leaseId, 'documents');
    this.ensureDir(outDir);
    const outPdfPath = path.join(outDir, packName);
    fsSync.writeFileSync(outPdfPath, mergedBuf);

    const ins = await this.pool.query(
      `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        row.unit_id,
        leaseId,
        docType,
        packName,
        outPdfPath.replace(this.storageBase, ''),
        mergedSha,
      ],
    );

    return { created: true, document: ins.rows[0], parts: { edlId: edlRes?.document?.id || null, invId: invRes?.document?.id || null } };
  }

  async generateExitCertificatePdf(
    leaseId: string,
    opts?: { force?: boolean },
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    const force = Boolean(opts?.force);

    const row = await this.fetchLeaseBundle(leaseId);
    const docs: any[] = await this.listDocsForLease(leaseId);

    const pickLatestDoc = (items: any[]) =>
      items
        .slice()
        .sort((a: any, b: any) =>
          String(b.created_at || '').localeCompare(String(a.created_at || '')),
        )[0] || null;

    const pickRootByType = (type: string) =>
      pickLatestDoc(
        docs.filter(
          (d: any) =>
            d.type === type &&
            !d.parent_document_id,
        ),
      );

    const resolveSignedFinalFromRoot = (rootDoc: any | null) => {
      if (!rootDoc) return null;

      if (rootDoc.signed_final_document_id) {
        return (
          docs.find((d: any) => String(d.id) === String(rootDoc.signed_final_document_id)) ||
          null
        );
      }

      return (
        docs.find(
          (d: any) =>
            String(d.parent_document_id || '') === String(rootDoc.id) &&
            String(d.filename || '').includes('_SIGNED_FINAL'),
        ) || null
      );
    };

    const edlRoot = pickRootByType('EDL_SORTIE');
    const inventaireRoot = pickRootByType('INVENTAIRE_SORTIE');

    const edlSignedFinal = resolveSignedFinalFromRoot(edlRoot);
    const inventaireSignedFinal = resolveSignedFinalFromRoot(inventaireRoot);

    if (!edlSignedFinal) {
      throw new BadRequestException(
        edlRoot
          ? 'Exit certificate impossible: EDL_SORTIE présent mais SIGNED_FINAL introuvable.'
          : 'Exit certificate impossible: EDL_SORTIE introuvable.',
      );
    }

    if (!inventaireSignedFinal) {
      throw new BadRequestException(
        inventaireRoot
          ? 'Exit certificate impossible: INVENTAIRE_SORTIE présent mais SIGNED_FINAL introuvable.'
          : 'Exit certificate impossible: INVENTAIRE_SORTIE introuvable.',
      );
    }

    const pdfName = `ATTESTATION_SORTIE_${row.unit_code}_${this.isoDate(new Date())}.pdf`;

    const existing = await this.findExistingDocByFilename({
      leaseId,
      type: 'ATTESTATION_SORTIE',
      filename: pdfName,
      parentNullOnly: true,
    });

    if (existing && !force) {
      return { created: false, document: existing };
    }

    if (existing && force) {
      const abs = this.absFromStoragePath(existing.storage_path);
      await this.deleteDocumentRow(existing.id);
      await this.safeUnlinkAbs(abs);
    }

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.4;padding:24px}
    h1{font-size:18pt;margin:0 0 12px 0}
    .box{border:1px solid #ddd;padding:12px;border-radius:8px;margin:12px 0}
    .small{color:#555;font-size:10pt}
    table{border-collapse:collapse;width:100%;margin-top:10px}
    td{border:1px solid #eee;padding:8px;vertical-align:top}
    .k{width:30%;background:#fafafa;font-weight:700}
  </style>
</head>
<body>
  <h1>Attestation de sortie</h1>

  <div class="box">
    <b>Bail :</b> ${this.escapeHtml(String(leaseId))}<br/>
    <b>Logement :</b> ${this.escapeHtml(String(row.unit_label || ''))} (${this.escapeHtml(String(row.unit_code || ''))})<br/>
    <b>Adresse :</b> ${this.escapeHtml(String(row.unit_address_line1 || ''))}, ${this.escapeHtml(String(row.unit_postal_code || ''))} ${this.escapeHtml(String(row.unit_city || ''))}<br/>
    <b>Locataire principal :</b> ${this.escapeHtml(String(row.tenant_name || ''))}
  </div>

  <table>
    <tr>
      <td class="k">EDL de sortie signé final</td>
      <td>${this.escapeHtml(String(edlSignedFinal.filename || ''))}</td>
    </tr>
    <tr>
      <td class="k">Inventaire de sortie signé final</td>
      <td>${this.escapeHtml(String(inventaireSignedFinal.filename || ''))}</td>
    </tr>
    <tr>
      <td class="k">Date d’émission</td>
      <td>${this.escapeHtml(this.formatDateFr(new Date()))}</td>
    </tr>
  </table>

  <div class="box">
    La présente attestation constate que le dossier de sortie comporte un état des lieux de sortie signé
    ainsi qu’un inventaire de sortie signé pour le bail concerné.
  </div>

  <p class="small">
    Document généré par RentalOS.
  </p>
</body>
</html>`;

    const pdfBuf = await this.htmlToPdfBuffer(html);

    const outDir = path.join(
      this.storageBase,
      'units',
      row.unit_id,
      'leases',
      leaseId,
      'documents',
    );
    this.ensureDir(outDir);

    const outPdfPath = path.join(outDir, pdfName);
    fsSync.writeFileSync(outPdfPath, pdfBuf);

    const sha = this.sha256File(outPdfPath);

    const ins = await this.pool.query(
      `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        row.unit_id,
        leaseId,
        'ATTESTATION_SORTIE',
        pdfName,
        outPdfPath.replace(this.storageBase, ''),
        sha,
      ],
    );

    return { created: true, document: ins.rows[0] };
  }

  async generateExitPackPdf(
    leaseId: string,
    opts?: { force?: boolean },
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    const force = Boolean(opts?.force);

    const row = await this.fetchLeaseBundle(leaseId);
    const docs: any[] = await this.listDocsForLease(leaseId);

    const pickLatestDoc = (items: any[]) =>
      items
        .slice()
        .sort((a: any, b: any) =>
          String(b.created_at || '').localeCompare(String(a.created_at || '')),
        )[0] || null;

    const pickRootByType = (type: string) =>
      pickLatestDoc(
        docs.filter(
          (d: any) =>
            d.type === type &&
            !d.parent_document_id,
        ),
      );

    const resolveSignedFinalFromRoot = (rootDoc: any | null) => {
      if (!rootDoc) return null;

      if (rootDoc.signed_final_document_id) {
        return (
          docs.find((d: any) => String(d.id) === String(rootDoc.signed_final_document_id)) ||
          null
        );
      }

      return (
        docs.find(
          (d: any) =>
            String(d.parent_document_id || '') === String(rootDoc.id) &&
            String(d.filename || '').includes('_SIGNED_FINAL'),
        ) || null
      );
    };

    const edlRoot = pickRootByType('EDL_SORTIE');
    const inventaireRoot = pickRootByType('INVENTAIRE_SORTIE');

    const edlSignedFinal = resolveSignedFinalFromRoot(edlRoot);
    const inventaireSignedFinal = resolveSignedFinalFromRoot(inventaireRoot);

    if (!edlSignedFinal || !inventaireSignedFinal) {
      throw new BadRequestException('Exit pack impossible: missing signed final exit documents');
    }

    const attestationRes = await this.generateExitCertificatePdf(leaseId, { force });
    const attestationDoc = attestationRes.document;

    const packName = `PACK_SORTIE_${row.unit_code}_${this.isoDate(new Date())}.pdf`;

    const existing = await this.findExistingDocByFilename({
      leaseId,
      type: 'PACK_EDL_INV_SORTIE',
      filename: packName,
      parentNullOnly: true,
    });

    if (existing && !force) {
      return { created: false, document: existing };
    }

    if (existing && force) {
      const abs = this.absFromStoragePath(existing.storage_path);
      await this.deleteDocumentRow(existing.id);
      await this.safeUnlinkAbs(abs);
    }

    const ordered: Array<{ filename: string; doc: any }> = [
      { filename: '01_EDL_SORTIE_SIGNED_FINAL.pdf', doc: edlSignedFinal },
      { filename: '02_INVENTAIRE_SORTIE_SIGNED_FINAL.pdf', doc: inventaireSignedFinal },
      { filename: '03_ATTESTATION_SORTIE.pdf', doc: attestationDoc },
    ];

    const parts = ordered
      .map(({ filename, doc }) => {
        const p = this.safeReadPdfPart(doc);
        return p ? { filename, buffer: p.buffer } : null;
      })
      .filter(Boolean) as Array<{ filename: string; buffer: Buffer }>;

    if (!parts.length) {
      throw new BadRequestException('Exit pack: no PDFs found to merge');
    }

    const mergedBuf = await this.mergePdfsGotenberg(parts);
    const mergedSha = this.sha256Buffer(mergedBuf);

    const outDir = path.join(
      this.storageBase,
      'units',
      row.unit_id,
      'leases',
      leaseId,
      'documents',
    );
    this.ensureDir(outDir);

    const outPdfPath = path.join(outDir, packName);
    fsSync.writeFileSync(outPdfPath, mergedBuf);

    const ins = await this.pool.query(
      `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        row.unit_id,
        leaseId,
        'PACK_EDL_INV_SORTIE',
        packName,
        outPdfPath.replace(this.storageBase, ''),
        mergedSha,
      ],
    );

    return {
      created: true,
      document: ins.rows[0],
      parts: {
        edlId: edlSignedFinal.id,
        invId: inventaireSignedFinal.id,
        attestationId: attestationDoc?.id || null,
      },
    };
  }

    private safeReadPdfPart(doc: any): { filename: string; buffer: Buffer } | null {
      const d = doc?.document ? doc.document : doc; // accepte {created, document} OU document direct
      if (!d?.storage_path || !d?.filename) return null;
      const abs = this.absFromStoragePath(d.storage_path);
      if (!fsSync.existsSync(abs)) return null;
      return { filename: d.filename, buffer: fsSync.readFileSync(abs) };
    }

    private safeReadPdfPartByFilename(filename: string, buffer: Buffer): { filename: string; buffer: Buffer } | null {
      if (!filename || !buffer) return null;
      return { filename, buffer };
    }

  // ---------------------------------------------
  // Signatures (kept) + ✅ SIGNATURE GUARD
  // ---------------------------------------------
  private async generateSignaturePagePdf(args: {
    unitCode: string;
    leaseId: string;
    signerName: string;
    signerRole: string;
    signatureDataUrl: string;
    originalPdfSha256: string;
    signedAtIso: string;
    auditJson: any;
  }): Promise<Buffer> {
    const { unitCode, leaseId, signerName, signerRole, signatureDataUrl, originalPdfSha256, signedAtIso, auditJson } = args;

    const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<style>
body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.35}
h1{font-size:15pt;margin:0 0 10px 0}
.box{border:1px solid #ddd;padding:10px;margin:10px 0;border-radius:8px}
.small{color:#555;font-size:10pt}
img{max-width:520px;height:auto;border:1px solid #aaa;border-radius:8px}
code{word-break:break-all}
</style></head>
<body>
<h1>Annexe — Attestation de signature (RentalOS)</h1>

<div class="box">
<b>Bail :</b> ${leaseId}<br/>
<b>Logement :</b> ${unitCode}<br/>
<b>Signataire :</b> ${this.escapeHtml(signerName)} (${this.escapeHtml(signerRole)})<br/>
<b>Date :</b> ${signedAtIso}<br/>
</div>

<div class="box">
<b>Signature (image)</b><br/>
<img src="${signatureDataUrl}" alt="signature"/>
</div>

${String(signerRole).toUpperCase() === 'GARANT' && auditJson?.guarantorMention
  ? `<div class="box">
<b>Mention obligatoire recopiée par la caution :</b><br/>
<div>${this.escapeHtml(String(auditJson.guarantorMention))}</div>
</div>`
  : ''}

<div class="box small">
<b>Empreinte (SHA-256) du PDF original :</b><br/>
<code>${originalPdfSha256}</code><br/><br/>
<b>Audit :</b><br/>
<pre>${JSON.stringify(auditJson, null, 2)}</pre>
</div>
</body></html>`;

    return await this.htmlToPdfBuffer(html);
  }

  private async buildAuditPdf(args: {
  originalSha: string;
  signedSha: string;
  documentId: string;
  signatures: any[];
}) {
  const { originalSha, signedSha, documentId, signatures } = args;

  const sorted = [...(signatures || [])].sort((a: any, b: any) => {
    const sa = Number(a?.sequence ?? 0);
    const sb = Number(b?.sequence ?? 0);
    return sa - sb;
  });

  const rows = sorted
    .map((s: any) => {
      const signedAt = s?.signed_at ? new Date(s.signed_at).toISOString() : '';
      const consent =
        s?.audit_log?.consent === true ||
        (typeof s?.audit_log === 'string' && s.audit_log.includes('"consent":true'));

      return `
        <tr>
          <td>${this.escapeHtml(String(s?.sequence ?? ''))}</td>
          <td>${this.escapeHtml(String(s?.signer_role ?? ''))}</td>
          <td>${this.escapeHtml(String(s?.signer_name ?? ''))}</td>
          <td>${this.escapeHtml(signedAt)}</td>
          <td>${this.escapeHtml(String(s?.ip ?? ''))}</td>
          <td style="font-size:10px;word-break:break-all">${this.escapeHtml(String(s?.user_agent ?? ''))}</td>
          <td>${consent ? 'true' : 'false'}</td>
        </tr>
      `;
    })
    .join('');

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; padding: 36px; }
    h1 { font-size: 18px; margin: 0 0 10px 0; }
    .hash { font-size: 10px; word-break: break-all; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    td, th { border: 1px solid #000; padding: 6px; vertical-align: top; }
    th { background: #eee; }
    .small { font-size: 10px; color: #333; }
  </style>
</head>
<body>
  <h1>Annexe technique — Journal de signature</h1>

  <p><strong>Document ID :</strong> ${this.escapeHtml(documentId)}</p>

  <p><strong>SHA256 original :</strong><br/>
    <span class="hash">${this.escapeHtml(originalSha)}</span>
  </p>

  <p><strong>SHA256 signé :</strong><br/>
    <span class="hash">${this.escapeHtml(signedSha)}</span>
  </p>

  <h2 style="font-size:14px;margin-top:18px">Signatures</h2>

  <table>
    <tr>
      <th>#</th>
      <th>Rôle</th>
      <th>Nom</th>
      <th>Date (ISO)</th>
      <th>IP</th>
      <th>User-Agent</th>
      <th>Consent</th>
    </tr>
    ${rows}
  </table>

  <p class="small" style="margin-top:24px">
    Ce journal technique atteste de l'ordre et des conditions de signature du document.
  </p>
</body>
</html>`;

  return this.htmlToPdfBuffer(html);
}

  async signDocumentMulti(documentId: string, body: any, req: any) {
    const {
      signerName,
      signerRole,
      signatureDataUrl,
      signerTenantId,
      guarantorMention,
      guarantorMentionRequired,
    } = body || {};
    if (!signerName || !signerRole || !signatureDataUrl) {
      throw new BadRequestException('Missing signerName/signerRole/signatureDataUrl');
    }

    const allowedRoles = new Set(['BAILLEUR', 'LOCATAIRE', 'GARANT']);
    if (!allowedRoles.has(String(signerRole))) {
      throw new BadRequestException('signerRole must be BAILLEUR, LOCATAIRE or GARANT');
    }

    const normalizeGuarantorMention = (v: any) =>
  String(v || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[€.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

    const isGuarantorMentionValid = (input: any, expected: any) => {
      const a = normalizeGuarantorMention(input);
      const e = normalizeGuarantorMention(expected);

      if (!a || !e) return false;

      const requiredFragments = [
        'en me portant caution solidaire',
        'dans la limite de la somme',
        'couvrant le paiement du principal',
        'penalites ou interets de retard',
        "je m'engage a rembourser au bailleur",
        'sur mes revenus et mes biens',
        'je reconnais avoir parfaitement connaissance',
        "nature et de l'etendue de mon engagement",
      ];

      const hasRequiredFragments = requiredFragments.every((fragment) =>
        a.includes(normalizeGuarantorMention(fragment)),
      );

      const expectedAmountMatch = e.match(/somme de ([0-9 ]+)/);
      const expectedAmount = expectedAmountMatch?.[1]?.replace(/\s+/g, '');

      const actualHasAmount = expectedAmount
        ? a.replace(/\s+/g, '').includes(expectedAmount)
        : true;

      return hasRequiredFragments && actualHasAmount;
    };

    const normalizedGuarantorMention = String(guarantorMention || '').trim();
    const normalizedGuarantorMentionRequired = String(guarantorMentionRequired || '').trim();

    if (String(signerRole).toUpperCase() === 'GARANT') {
      if (!normalizedGuarantorMention || !normalizedGuarantorMentionRequired) {
        throw new BadRequestException('Missing guarantor mention');
      }

      if (!isGuarantorMentionValid(normalizedGuarantorMention, normalizedGuarantorMentionRequired)) {
        throw new BadRequestException('Invalid guarantor mention');
      }
    }

    const docR = await this.pool.query(`SELECT * FROM documents WHERE id=$1`, [documentId]);
    if (!docR.rowCount) throw new BadRequestException('Unknown document');
    const doc = docR.rows[0];

    let effectiveSignerName = String(signerName || "").trim();

    if (String(signerRole).toUpperCase() === "BAILLEUR") {
      const landlord = await this.getLandlordForLease(String(doc.lease_id || ""));
      const landlordName = String(landlord?.name || "").trim();

      if (!effectiveSignerName || effectiveSignerName.toLowerCase() === "bailleur") {
        effectiveSignerName = landlordName || "Bailleur";
      }
    }

    if (!this.isMultiSignableDocType(doc.type)) {
      throw new BadRequestException(`Unsupported signable document type: ${doc.type}`);
    }

    console.log('[SIGN DOC INPUT]', {
      documentId,
      docType: doc.type,
      filename: doc.filename,
      leaseId: doc.lease_id,
      signerRole,
      signerName,
      signerTenantId,
    });

    // ✅ Guard: lease + tenants
    const leaseRow = await this.assertSignableLeaseOrThrow(doc.lease_id);
    const tenants = this.getTenantsFromLeaseRow(leaseRow);

    // --- GARANT guard (MVP: legacy columns OR guarantors_json) ---
    const hasLegacyGuarantor =
      Boolean(String(leaseRow?.guarantor_full_name || '').trim()) ||
      Boolean(String(leaseRow?.guarantor_email || '').trim()) ||
      Boolean(String(leaseRow?.guarantor_phone || '').trim()) ||
      Boolean(String(leaseRow?.guarantor_address || '').trim());

    const gArr = this.parseJsonSafe((leaseRow as any)?.guarantors_json);
    const hasGuarantorsJson = Array.isArray(gArr) && gArr.length > 0;

    if (signerRole === 'GARANT') {
      // Only allowed for GUARANTOR_ACT document
      if (String(doc.type) !== 'GUARANTOR_ACT') {
        throw new BadRequestException('GARANT signature only allowed on GUARANTOR_ACT documents');
      }
      // ✅ source robuste: lease_guarantees
      const gq = await this.pool.query(
        `SELECT 1
        FROM lease_guarantees
        WHERE lease_id=$1 AND type='CAUTION' AND selected=true
        LIMIT 1`,
        [doc.lease_id],
      );
      if (!gq.rowCount && !hasLegacyGuarantor && !hasGuarantorsJson) {
        throw new BadRequestException('No guarantor configured on this lease');
      }
    }

    // helper: normalize
    const norm = (s: any) => String(s || '').trim().toLowerCase();

    // accepte tenant_id OU id (au cas où)
    let tenantIds = tenants
      .map(t => t?.tenant_id || t?.id)
      .filter(Boolean);

    // fallback sur la colonne principale du bail (l.tenant_id)
    if (tenantIds.length === 0 && leaseRow?.tenant_id) {
      tenantIds = [leaseRow.tenant_id];
    }

    // ✅ resolve effectiveTenantId (required when LOCATAIRE)
    let effectiveTenantId = '';
    if (signerRole === 'LOCATAIRE') {
      // mono-locataire: auto
      if (tenantIds.length <= 1) {
        effectiveTenantId = tenantIds[0] || String(signerTenantId || '').trim();
      } else {
        // multi-locataires: 1) explicit id
        effectiveTenantId = String(signerTenantId || '').trim();

        // 2) auto-resolve by signerName if not provided
        if (!effectiveTenantId) {
          const matches = tenants.filter((t: any) => norm(t?.full_name) === norm(signerName));
          if (matches.length === 1) {
            effectiveTenantId = String(matches[0]?.tenant_id || '').trim();
          }
        }

        // still missing => send UI-friendly error
        if (!effectiveTenantId) {
          throw new BadRequestException({
            message: 'Missing signerTenantId (required when multiple tenants)',
            tenants: tenants.map((t: any) => ({
              tenantId: String(t?.tenant_id || '').trim(),
              fullName: t?.full_name || '',
              role: t?.role || '',
            })),
          } as any);
        }
      }

      // validate tenantId belongs to lease
      const allowed = new Set(tenants.map((t: any) => String(t?.tenant_id || '').trim()).filter(Boolean));
      if (effectiveTenantId && allowed.size && !allowed.has(effectiveTenantId)) {
        throw new BadRequestException('signerTenantId is not a tenant of this lease');
      }
      if (!effectiveTenantId) {
        throw new BadRequestException('Unable to resolve signerTenantId for tenant signature');
      }
    }

    const absPdf = this.absFromStoragePath(doc.storage_path);
    if (!fsSync.existsSync(absPdf)) throw new BadRequestException('PDF file missing');

    const originalPdfBuf = fsSync.readFileSync(absPdf);
    const originalSha = this.sha256Buffer(originalPdfBuf);

      // ✅ anti double signature (guarantor)
    if (signerRole === 'GARANT') {
      const already = await this.pool.query(
        `SELECT id, signed_at
        FROM signatures
        WHERE document_id=$1
          AND signer_role='GARANT'
        ORDER BY signed_at DESC
        LIMIT 1`,
        [doc.id],
      );

      if (already.rowCount) {
        const sigsNow = await this.pool.query(
          `SELECT * FROM signatures WHERE document_id=$1 ORDER BY sequence ASC`,
          [doc.id],
        );

        return {
          ok: true,
          pending: false,
          alreadySigned: true,
          signatures: sigsNow.rows,
        };
      }
    }

    // ✅ anti double signature (tenant)
    if (signerRole === 'LOCATAIRE') {
      const already = await this.pool.query(
        `SELECT id, signed_at
        FROM signatures
        WHERE document_id=$1
          AND signer_role='LOCATAIRE'
          AND COALESCE(audit_log->>'tenantId','') = $2
        ORDER BY signed_at DESC
        LIMIT 1`,
        [doc.id, effectiveTenantId],
      );
      if (already.rowCount) {
        // Return current state without creating another signature row
        const sigsNow = await this.pool.query(`SELECT * FROM signatures WHERE document_id=$1 ORDER BY signed_at DESC`, [doc.id]);
        // rebuild latest maps
        const latestTenantSigByTenantId: Record<string, any> = {};
        let latestGuarantSig: any = null;
        let latestLandlordSig: any = null;
        for (const s of sigsNow.rows) {
          if (s.signer_role === 'BAILLEUR') {
            if (!latestLandlordSig) latestLandlordSig = s;
            continue;
          }

          if (s.signer_role === 'GARANT') {
            if (!latestGuarantSig) latestGuarantSig = s;
            continue;
          }

          if (s.signer_role === 'LOCATAIRE') {
            const tid = this.pickTenantIdFromSignature(s);
            if (!tid) continue;
            if (!latestTenantSigByTenantId[tid]) latestTenantSigByTenantId[tid] = s;
          }
        }

        const signedTenantIds = tenantIds.filter((id) => Boolean(latestTenantSigByTenantId[id]));
        const missingTenantIds = tenantIds.filter((id) => !latestTenantSigByTenantId[id]);
        const hasAllTenants = tenantIds.length ? signedTenantIds.length === tenantIds.length : Boolean(Object.keys(latestTenantSigByTenantId).length);
        const hasLandlord = Boolean(latestLandlordSig);

        return {
          ok: true,
          pending: !(hasAllTenants && hasLandlord),
          alreadySigned: true,
          need: {
            landlord: !hasLandlord,
            tenantsMissing: missingTenantIds,
            tenantsSigned: signedTenantIds,
            tenantsTotal: tenantIds.length,
          },
          signatures: [...Object.values(latestTenantSigByTenantId), latestLandlordSig].filter(Boolean),
        };
      }
    }

    const m = String(signatureDataUrl).match(/^data:image\/png;base64,(.+)$/);
    if (!m) throw new BadRequestException('Signature must be PNG data URL');
    const imgBuf = Buffer.from(m[1], 'base64');
    if (imgBuf.length > 2_000_000) {
    throw new BadRequestException('Signature too large');
    }

    const sigDir = path.join(this.storageBase, 'units', doc.unit_id, 'leases', doc.lease_id, 'signatures');
    this.ensureDir(sigDir);

    const sigFile =
      signerRole === 'LOCATAIRE'
        ? `signature_${documentId}_${signerRole}_${effectiveTenantId}_${Date.now()}.png`
        : `signature_${documentId}_${signerRole}_${Date.now()}.png`;

    const sigAbs = path.join(sigDir, sigFile);
    fsSync.writeFileSync(sigAbs, imgBuf);

    const signedAt = new Date().toISOString();

    // ✅ sequence: locataires d’abord (dans l’ordre tenants_json), bailleur en dernier
    const tenantIndexById = new Map<string, number>();
    tenants.forEach((t: any, idx: number) => {
      const id = String(t?.tenant_id || '').trim();
      if (id) tenantIndexById.set(id, idx);
    });

    const docType = String(doc.type || '').toUpperCase();
    const isGuarantorAct = docType === 'GUARANTOR_ACT';

    const isEdl =
      docType === 'EDL_ENTREE' || docType === 'EDL_SORTIE';

    const isInventory =
      docType === 'INVENTAIRE_ENTREE' || docType === 'INVENTAIRE_SORTIE';

    const sequence =
      isGuarantorAct
        ? (signerRole === 'GARANT' ? 1 : signerRole === 'BAILLEUR' ? 2 : 99)
        : signerRole === 'BAILLEUR'
          ? tenants.length + 1
          : signerRole === 'GARANT'
            ? tenants.length + 2
            : (tenantIndexById.get(effectiveTenantId) ?? 0) + 1;

    const audit = {
      consent: true,
      signedAt,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      documentId,
      signerRole,
      signerName: effectiveSignerName,
      tenantId: signerRole === 'LOCATAIRE' ? effectiveTenantId : null,
      originalPdfSha256: originalSha,

      ...(String(signerRole).toUpperCase() === 'GARANT'
        ? {
            guarantorMention: normalizedGuarantorMention,
            guarantorMentionRequired: normalizedGuarantorMentionRequired,
            guarantorMentionMatched: isGuarantorMentionValid(
              normalizedGuarantorMention,
              normalizedGuarantorMentionRequired,
            ),
          }
        : {}),
    };

    await this.pool.query(
      `INSERT INTO signatures (document_id, signer_role, signer_name, signer_tenant_id, signature_image_path, ip, user_agent, pdf_sha256, audit_log, sequence)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        doc.id,
        signerRole as SignRole,
        effectiveSignerName,
        signerRole === 'LOCATAIRE' ? (effectiveTenantId || null) : null,
        sigAbs.replace(this.storageBase, ''),
        req.ip,
        req.headers['user-agent'],
        originalSha,
        audit,
        sequence,
      ],
    );

    const sigs = await this.pool.query(`SELECT * FROM signatures WHERE document_id=$1 ORDER BY signed_at DESC`, [doc.id]);

    const latestTenantSigByTenantId: Record<string, any> = {};
    let latestLandlordSig: any = null;
    let latestGuarantSig: any = null;

    for (const s of sigs.rows) {
      if (s.signer_role === 'BAILLEUR') {
        if (!latestLandlordSig) latestLandlordSig = s;
        continue;
      }
      // ✅ AJOUTER CE BLOC
      if (s.signer_role === 'GARANT') {
        if (!latestGuarantSig) latestGuarantSig = s;
        continue;
      }
      if (s.signer_role === 'LOCATAIRE') {
        const tid = this.pickTenantIdFromSignature(s);
        if (!tid) continue;
        if (!latestTenantSigByTenantId[tid]) latestTenantSigByTenantId[tid] = s;
      }
    }

    const signedTenantIds = tenantIds.filter((id) => Boolean(latestTenantSigByTenantId[id]));
    const missingTenantIds = tenantIds.filter((id) => !latestTenantSigByTenantId[id]);

    const hasAllTenants = tenantIds.length
      ? signedTenantIds.length === tenantIds.length
      : Boolean(Object.keys(latestTenantSigByTenantId).length);

    const hasLandlord = Boolean(latestLandlordSig);
    const hasGuarantor = Boolean(latestGuarantSig);

    const requiredRoles = this.getRequiredRolesForDocument(doc.type);

    const needTenant = requiredRoles.includes('LOCATAIRE');
    const needLandlord = requiredRoles.includes('BAILLEUR');
    const needGuarantor = requiredRoles.includes('GARANT');

    const readyToFinalize =
      (!needTenant || hasAllTenants) &&
      (!needLandlord || hasLandlord) &&
      (!needGuarantor || hasGuarantor);

    console.log('[SIGN READY CHECK]', {
      documentId: doc.id,
      docType: doc.type,
      isGuarantorAct,
      signerRole,
      hasAllTenants,
      hasLandlord,
      hasGuarantor,
      readyToFinalize,
      signedTenantIds,
      missingTenantIds,
    });    

      if (readyToFinalize) {
      if (doc.signed_final_document_id) {
        const finalDoc = await this.pool.query(
          `SELECT * FROM documents WHERE id=$1`,
          [doc.signed_final_document_id],
        );
        const finalSignedDocument = finalDoc.rowCount ? finalDoc.rows[0] : null;

        const sigQ = await this.pool.query(
          `SELECT * FROM signatures WHERE document_id=$1 ORDER BY sequence ASC`,
          [doc.id],
        );

        return {
          ok: true,
          pending: false,
          alreadyFinalized: true,
          finalSignedDocument,
          signatures: sigQ.rows,
          signaturesPdfSha256:
            doc.signed_final_sha256 || finalSignedDocument?.sha256 || null,
        };
      }

      const unitQ = await this.pool.query(`SELECT code FROM units WHERE id=$1`, [
        doc.unit_id,
      ]);
      const unitCode = unitQ.rowCount ? unitQ.rows[0].code : 'UNIT';

      const tenantSigsOrdered = tenantIds
        .map((id) => latestTenantSigByTenantId[id])
        .filter(Boolean)
        .sort((a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0));

      const sigOrder: any[] = isGuarantorAct
        ? [latestGuarantSig, latestLandlordSig].filter(Boolean)
        : [...tenantSigsOrdered, latestLandlordSig].filter(Boolean);

      const sigPages: Buffer[] = [];
      for (const s of sigOrder) {
        const sigImgAbs = this.absFromStoragePath(s.signature_image_path);
        const sigDataUrl = this.fileToDataUrlPng(sigImgAbs);

        const pageBuf = await this.generateSignaturePagePdf({
          unitCode,
          leaseId: doc.lease_id,
          signerName: s.signer_name,
          signerRole: s.signer_role,
          signatureDataUrl: sigDataUrl,
          originalPdfSha256: originalSha,
          signedAtIso: new Date(s.signed_at).toISOString(),
          auditJson: s.audit_log,
        });
        sigPages.push(pageBuf);
      }

      const mergeParts: Array<{ filename: string; buffer: Buffer }> = [];
      mergeParts.push({
        filename: doc.filename || 'document.pdf',
        buffer: originalPdfBuf,
      });

      sigOrder.forEach((s: any, idx: number) => {
        if (s.signer_role === 'LOCATAIRE') {
          const tid = this.pickTenantIdFromSignature(s) || `tenant_${idx + 1}`;
          mergeParts.push({
            filename: `signature_locataire_${idx + 1}_${tid}.pdf`,
            buffer: sigPages[idx],
          });
        } else if (s.signer_role === 'GARANT') {
          mergeParts.push({
            filename: `signature_garant.pdf`,
            buffer: sigPages[idx],
          });
        } else {
          mergeParts.push({
            filename: `signature_bailleur.pdf`,
            buffer: sigPages[idx],
          });
        }
      });

      const mergedBuf = await this.mergePdfsGotenberg(mergeParts);
      const mergedSha = this.sha256Buffer(mergedBuf);

      const signedDir = path.join(
        this.storageBase,
        'units',
        doc.unit_id,
        'leases',
        doc.lease_id,
        'documents',
      );
      this.ensureDir(signedDir);

      const signedName =
        (doc.filename || 'document.pdf').replace(/\.pdf$/i, '') +
        `_SIGNED_FINAL.pdf`;
      const signedAbs2 = path.join(signedDir, signedName);
      fsSync.writeFileSync(signedAbs2, mergedBuf);

      const finalType: DocType = doc.type as DocType;

      const insDoc = await this.pool.query(
        `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256, parent_document_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          doc.unit_id,
          doc.lease_id,
          finalType,
          signedName,
          signedAbs2.replace(this.storageBase, ''),
          mergedSha,
          doc.id,
        ],
      );

      await this.pool.query(
        `UPDATE documents
        SET signed_final_document_id=$1,
            finalized_at = NOW(),
            signed_final_sha256 = $3
        WHERE id=$2`,
        [insDoc.rows[0].id, doc.id, mergedSha],
      );

      if (isGuarantorAct) {
        try {
          await this.pool.query(
            `
            UPDATE lease_guarantees
            SET signed_final_document_id = $1
            WHERE lease_id = $2
              AND type = 'CAUTION'
              AND guarantor_act_document_id = $3
            `,
            [insDoc.rows[0].id, doc.lease_id, doc.id],
          );
        } catch (e) {
          console.warn(
            '[GUARANTOR_ACT] failed to sync lease_guarantees.signed_final_document_id',
            e,
          );
        }
      }

      const finalSignedDocument = insDoc.rows[0];

      console.log('[SIGNED FINAL CREATED]', {
        sourceDocumentId: doc.id,
        sourceType: doc.type,
        finalSignedDocumentId: finalSignedDocument.id,
        finalType: finalSignedDocument.type,
        filename: finalSignedDocument.filename,
      });

      if (isGuarantorAct) {
        return {
          ok: true,
          pending: false,
          finalSignedDocument,
          packFinalDocument: null,
          signatures: sigOrder,
          signedPdfSha256: mergedSha,
        };
      }

      const leaseRowForPack = await this.fetchLeaseBundle(
        finalSignedDocument.lease_id,
      );
      const leaseKindForPack = String(leaseRowForPack.kind || '').toUpperCase();

      if (leaseKindForPack === 'MEUBLE_RP') {
        // Prépare les documents racine nécessaires à la suite du parcours
        // sans générer le PACK_FINAL à ce stade.
        await this.generateNoticePdf(finalSignedDocument.lease_id);
        await this.generateEdlPdf(finalSignedDocument.lease_id, {
          phase: 'entry',
        });
        await this.generateInventoryPdf(finalSignedDocument.lease_id, {
          phase: 'entry',
        });
      }

      // Important :
      // ne pas générer le PACK_FINAL à la finalisation du contrat.
      // Le parcours prévoit que l'EDL et l'inventaire peuvent être signés après.
      return {
        ok: true,
        pending: false,
        finalSignedDocument,
        packFinalDocument: null,
        signatures: sigOrder,
        signedPdfSha256: mergedSha,
      };
    }

    if (requiredRoles.includes('GARANT')) {
      return {
        ok: true,
        pending: true,
        need: {
          guarantor: !hasGuarantor,
          landlord: !hasLandlord,
        },
        signatures: [latestGuarantSig, latestLandlordSig].filter(Boolean),
      };
    }

    return {
      ok: true,
      pending: true,
      need: {
        landlord: !hasLandlord,
        tenantsMissing: missingTenantIds,
        tenantsSigned: signedTenantIds,
        tenantsTotal: tenantIds.length,
      },
      signatures: [...Object.values(latestTenantSigByTenantId), latestLandlordSig].filter(Boolean),
    };
  }
}
