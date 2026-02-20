import { Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

type SignRole = 'BAILLEUR' | 'LOCATAIRE';
type LeaseKind = 'MEUBLE_RP' | 'NU_RP' | 'SAISONNIER';

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
    fs.mkdirSync(p, { recursive: true });
  }

  private sha256Buffer(buf: Buffer) {
    return crypto.createHash('sha256').update(buf).digest('hex');
  }

  private sha256File(absPath: string) {
    const buf = fs.readFileSync(absPath);
    return this.sha256Buffer(buf);
  }

  private fileToDataUrlPng(absPath: string) {
    const b = fs.readFileSync(absPath);
    return `data:image/png;base64,${b.toString('base64')}`;
  }

  private isoDate(d: any): string {
    if (!d) return '';
    const s = String(d);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    return s.slice(0, 10);
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
  private async getTemplate(kind: string, leaseKind: LeaseKind, version = '2026-02'): Promise<TemplateRow> {
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
    // Node 18+ : fetch / FormData / Blob are available. Otherwise polyfill required.
    const form = new FormData();
    form.append('files', new Blob([new Uint8Array(Buffer.from(html, 'utf-8'))], { type: 'text/html' }), 'index.html');
    const resp = await fetch(`${this.gotenberg}/forms/chromium/convert/html`, { method: 'POST', body: form as any });
    if (!resp.ok) throw new BadRequestException(`PDF generation failed: ${await resp.text()}`);
    return Buffer.from(await resp.arrayBuffer());
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


  // -------------------------------------
  // Blocks
  // -------------------------------------

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

    const gArr = this.parseJsonSafe(row.guarantors_json);
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
      return `<div class="small"><b>Caution solidaire :</b> aucune (non prévue).</div>`;
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
      <div class="small">
        <b>Caution solidaire :</b> oui (garant(s) ci-dessous).<br/>
        La/Les caution(s) s’engage(nt) solidairement au paiement des sommes dues au titre du bail selon l’acte de cautionnement annexé.
      </div>
      <div style="margin-top:8px">${items}</div>
    `;
  }

  /**
   * ✅ Visale supporté via:
   * - l.visale_json (object)
   * fallback:
   * - l.visale_visa_number / l.visale_enabled etc. (si existant)
   */
  private buildVisaleBlock(row: AnyRow): string {
    if (row.visale_block && String(row.visale_block).includes('<')) return String(row.visale_block);

    const v = this.parseJsonSafe(row.visale_json) || null;

    // fallback simple (si tu as déjà des colonnes)
    const enabledFallback = String(row.visale_enabled ?? '').toLowerCase() === 'true' || row.visale_enabled === 1;
    const visaNumberFallback = row.visale_visa_number || row.visaleVisaNumber;

    const enabled = Boolean(v?.enabled ?? enabledFallback ?? false);
    if (!enabled) {
      return `<div class="small"><b>Garantie Visale :</b> non (non prévue).</div>`;
    }

    const visaNumber = this.escapeHtml(v?.visaNumber || visaNumberFallback || '—');
    const tenantRef = this.escapeHtml(v?.tenantRef || v?.locataireRef || '—');
    const landlordRef = this.escapeHtml(v?.landlordRef || v?.bailleurRef || '—');
    const plafond = v?.maxAmountEur != null ? this.escapeHtml(v.maxAmountEur) : '—';
    const start = v?.startDate ? this.escapeHtml(this.formatDateFr(v.startDate)) : '—';
    const end = v?.endDate ? this.escapeHtml(this.formatDateFr(v.endDate)) : '—';

    return `
      <div class="small">
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

  private buildIrlClauseHtml(row: AnyRow): string {
    // ✅ IMPORTANT: your DB does NOT have irl_revision_date column (you hit SQL error)
    // So we use start_date as the annual revision reference date for now.
    const revisionDate = row.start_date;
    const revisionDateFr = this.formatDateFr(revisionDate);
    return `
      <div class="small">
        Le loyer pourra être révisé <b>une fois par an</b>, à la date du <b>${this.escapeHtml(revisionDateFr)}</b>,
        en fonction de la variation de l’<b>Indice de Référence des Loyers (IRL)</b> publié par l’INSEE,
        selon les dispositions légales applicables.
      </div>
    `;
  }

  // -------------------------------------
  // Documents list & downloads
  // -------------------------------------
  async listByLease(leaseId: string) {
    const r = await this.pool.query(`SELECT * FROM documents WHERE lease_id=$1 ORDER BY created_at DESC`, [leaseId]);
    return r.rows;
  }

  async getDocumentFile(documentId: string) {
    const r = await this.pool.query(`SELECT * FROM documents WHERE id=$1`, [documentId]);
    if (!r.rowCount) throw new BadRequestException('Unknown document');
    const doc = r.rows[0];
    const absPath = path.join(this.storageBase, doc.storage_path);
    return { absPath, filename: doc.filename };
  }

  private async fetchLeaseBundle(leaseId: string) {
    const q = await this.pool.query(
      `SELECT
          l.*,
          u.id as unit_id,
          u.code as unit_code,
          u.label as unit_label,
          u.address_line1 as unit_address_line1,
          u.city as unit_city,
          u.postal_code as unit_postal_code,
          u.surface_m2,
          u.floor,
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
        WHERE l.id=$1`,
      [leaseId],
    );
    if (!q.rowCount) throw new BadRequestException('Unknown leaseId');
    return q.rows[0];
  }

  // -------------------------------------
  // CONTRAT (templated)
  // -------------------------------------
  async generateContractPdf(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const row = await this.fetchLeaseBundle(leaseId);

    const leaseKind = String(row.kind || 'MEUBLE_RP').toUpperCase() as LeaseKind;
    if (leaseKind !== 'MEUBLE_RP' && leaseKind !== 'NU_RP' && leaseKind !== 'SAISONNIER') {
      throw new BadRequestException(`Unsupported lease kind for contract: ${leaseKind}`);
    }

    const templateVersion = '2026-02';
    const tpl = await this.getTemplate('CONTRACT', leaseKind, templateVersion);
    const irl = this.defaultIrl(row);

    const vars: Record<string, any> = {
      template_version: templateVersion,
      lease_id_short: this.leaseIdShort(leaseId),

      start_date: this.isoDate(row.start_date),
      end_date_theoretical: this.isoDate(row.end_date_theoretical),

      // Dates FR
      start_date_fr: this.formatDateFr(row.start_date),
      end_date_theoretical_fr: this.formatDateFr(row.end_date_theoretical),

      unit_code: this.escapeHtml(row.unit_code),
      unit_label: this.escapeHtml(row.unit_label),
      unit_address_line1: this.escapeHtml(row.unit_address_line1),
      unit_postal_code: this.escapeHtml(row.unit_postal_code),
      unit_city: this.escapeHtml(row.unit_city),
      project_name: this.escapeHtml(row.project_name || '-'),
      building_name: this.escapeHtml(row.building_name || '-'),

      landlord_name: this.escapeHtml(process.env.LANDLORD_NAME || 'Bailleur'),
      landlord_address: this.escapeHtml(process.env.LANDLORD_ADDRESS || '[À compléter]'),
      landlord_email: this.escapeHtml(process.env.LANDLORD_EMAIL || '[À compléter]'),
      landlord_phone: this.escapeHtml(process.env.LANDLORD_PHONE || '[À compléter]'),
      landlord_identifiers_html: this.buildLandlordIdentifiersHtml(),

      tenants_block: this.buildTenantsBlock(row),
      tenant_name: this.escapeHtml(row.tenant_name || ''),

      designation_block: this.buildDesignationBlock(row),
      colocation_clause: this.buildColocationClause(row),

      guarantor_block: this.buildGuarantorBlock(row),
      visale_block: this.buildVisaleBlock(row),

      rent_eur: this.toEuros(row.rent_cents),
      charges_eur: this.toEuros(row.charges_cents),
      deposit_eur: this.toEuros(row.deposit_cents),

      charges_clause_html: this.buildChargesClauseHtml(row),

      payment_day: String(row.payment_day ?? 5),

      // IRL
      irl_reference_quarter: this.escapeHtml(irl.quarter),
      irl_reference_value: this.escapeHtml(irl.value),
      // ✅ no irl_revision_date column -> use start_date
      irl_revision_date_fr: this.formatDateFr(row.start_date),
      irl_clause_html: this.buildIrlClauseHtml(row),

      signature_city: this.escapeHtml(process.env.SIGNATURE_CITY || row.unit_city || '—'),
      signature_date_fr: this.formatDateFr(new Date()),
    };

    const html = this.applyVars(tpl.html_template, vars);
    const pdfBuf = await this.htmlToPdfBuffer(html);

    const pdfName = `CONTRAT_${leaseKind}_${row.unit_code}_${this.isoDate(row.start_date)}.pdf`;
    const outDir = path.join(this.storageBase, 'units', row.unit_id, 'leases', leaseId, 'documents');
    this.ensureDir(outDir);
    const outPdfPath = path.join(outDir, pdfName);
    fs.writeFileSync(outPdfPath, pdfBuf);

    const sha = this.sha256File(outPdfPath);

    const ins = await this.pool.query(
      `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
       VALUES ($1,$2,'CONTRAT',$3,$4,$5) RETURNING *`,
      [row.unit_id, leaseId, pdfName, outPdfPath.replace(this.storageBase, ''), sha],
    );

    return ins.rows[0];
  }

  // ---------------------------------------------
  // NOTICE (RP only)
  // ---------------------------------------------
  async generateNoticePdf(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const row = await this.fetchLeaseBundle(leaseId);
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
<b>Locataire :</b> ${this.escapeHtml(row.tenant_name)}<br/>
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

    const pdfBuf = await this.htmlToPdfBuffer(html);

    const pdfName = `NOTICE_${leaseKind}_${row.unit_code}_${this.isoDate(row.start_date)}.pdf`;
    const outDir = path.join(this.storageBase, 'units', row.unit_id, 'leases', leaseId, 'documents');
    this.ensureDir(outDir);
    const outPdfPath = path.join(outDir, pdfName);
    fs.writeFileSync(outPdfPath, pdfBuf);

    const sha = this.sha256File(outPdfPath);

    const ins = await this.pool.query(
      `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
       VALUES ($1,$2,'NOTICE',$3,$4,$5) RETURNING *`,
      [row.unit_id, leaseId, pdfName, outPdfPath.replace(this.storageBase, ''), sha],
    );

    return ins.rows[0];
  }

  // ---------------------------------------------
  // EDL PDF (existing)
  // ---------------------------------------------
  async generateEdlPdf(leaseId: string) {
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

    const sQ = await this.pool.query(`SELECT * FROM edl_sessions WHERE lease_id=$1 ORDER BY created_at DESC LIMIT 1`, [
      leaseId,
    ]);
    if (!sQ.rowCount) throw new BadRequestException('No EDL session for this lease');
    const edlSession = sQ.rows[0];

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
       ORDER BY i.section, i.label, p.created_at ASC`,
      [leaseId],
    );
    const photos = photosQ.rows;

    const photoMap = new Map<string, any[]>();
    for (const p of photos) {
      const arr = photoMap.get(p.edl_item_id) || [];
      arr.push(p);
      photoMap.set(p.edl_item_id, arr);
    }

    const rowsHtml = items
      .map((it: any) => {
        const eCond = it.entry_condition ?? '';
        const eNotes = it.entry_notes ?? '';
        const xCond = it.exit_condition ?? '';
        const xNotes = it.exit_notes ?? '';
        const photoCount = (photoMap.get(it.id) || []).length;

        return `<tr>
        <td class="sec">${this.escapeHtml(it.section)}</td>
        <td class="lab">${this.escapeHtml(it.label)}</td>
        <td class="cond">${this.escapeHtml(eCond)}</td>
        <td class="notes">${this.escapeHtml(eNotes)}</td>
        <td class="cond">${this.escapeHtml(xCond)}</td>
        <td class="notes">${this.escapeHtml(xNotes)}</td>
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

        const abs = path.join(this.storageBase, p.storage_path);
        let dataUrl = '';
        try {
          const buf = fs.readFileSync(abs);
          dataUrl = `data:${p.mime_type};base64,${buf.toString('base64')}`;
        } catch {
          dataUrl = '';
        }

        annexHtml += `
          <div class="photo-block">
            <div class="photo-meta">${this.escapeHtml(p.filename)} • ${String(p.created_at).slice(0, 19)}</div>
            ${dataUrl ? `<img src="${dataUrl}" />` : `<div class="missing">Photo introuvable</div>`}
          </div>
        `;
      }
    }

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
<h1>État des lieux (Entrée + Sortie) — ${this.escapeHtml(lease.unit_code)}</h1>
<div class="small">Bail: ${leaseId} • Session EDL: ${edlSession.id}</div>

<div class="box">
<b>Logement :</b> ${this.escapeHtml(lease.unit_label)} (${this.escapeHtml(lease.unit_code)})<br/>
${this.escapeHtml(lease.address_line1)}, ${this.escapeHtml(lease.postal_code)} ${this.escapeHtml(lease.city)}<br/>
<b>Locataire :</b> ${this.escapeHtml(lease.tenant_name)}<br/>
<b>Période :</b> ${this.formatDateFr(lease.start_date)} → ${this.formatDateFr(lease.end_date_theoretical)}
</div>

<table>
  <thead>
    <tr>
      <th>Pièce</th><th>Élément</th>
      <th>Entrée<br/>État</th><th>Entrée<br/>Observations</th>
      <th>Sortie<br/>État</th><th>Sortie<br/>Observations</th>
      <th>Photos</th>
    </tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
</table>

<p class="small">Document généré par RentalOS. Les photos sont ajoutées en annexe.</p>
${annexHtml}
</body></html>`;

    const pdfName = `EDL_${lease.unit_code}_${this.isoDate(lease.start_date)}.pdf`;
    const outDir = path.join(this.storageBase, 'units', lease.unit_id, 'leases', leaseId, 'documents');
    this.ensureDir(outDir);
    const outPdfPath = path.join(outDir, pdfName);

    const pdfBuf = await this.htmlToPdfBuffer(html);
    fs.writeFileSync(outPdfPath, pdfBuf);

    const sha = this.sha256File(outPdfPath);

    const ins = await this.pool.query(
      `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
       VALUES ($1,$2,'EDL',$3,$4,$5) RETURNING *`,
      [lease.unit_id, leaseId, pdfName, outPdfPath.replace(this.storageBase, ''), sha],
    );

    return ins.rows[0];
  }

  // ---------------------------------------------
  // INVENTAIRE PDF (existing)
  // ---------------------------------------------
  async generateInventoryPdf(leaseId: string) {
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

    const sQ = await this.pool.query(
      `SELECT * FROM inventory_sessions WHERE lease_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [leaseId],
    );
    if (!sQ.rowCount) throw new BadRequestException('No inventory session for this lease');
    const invSession = sQ.rows[0];

    const linesQ = await this.pool.query(
      `SELECT c.category, c.name,
              il.entry_qty, il.entry_state, il.entry_notes,
              il.exit_qty, il.exit_state, il.exit_notes
       FROM inventory_lines il
       JOIN inventory_catalog_items c ON c.id = il.catalog_item_id
       WHERE il.inventory_session_id=$1
       ORDER BY c.category, c.name`,
      [invSession.id],
    );
    const lines = linesQ.rows;

    let currentCat = '';
    const rowsHtml = lines
      .map((ln: any) => {
        const cat = ln.category || 'Autre';
        const header =
          cat !== currentCat
            ? (() => {
                currentCat = cat;
                return `<tr class="catrow"><td colspan="7"><b>${this.escapeHtml(cat)}</b></td></tr>`;
              })()
            : '';
        return (
          header +
          `<tr>
        <td class="item">${this.escapeHtml(ln.name)}</td>
        <td class="qty">${ln.entry_qty ?? ''}</td>
        <td class="state">${this.escapeHtml(ln.entry_state ?? '')}</td>
        <td class="notes">${this.escapeHtml(ln.entry_notes ?? '')}</td>
        <td class="qty">${ln.exit_qty ?? ''}</td>
        <td class="state">${this.escapeHtml(ln.exit_state ?? '')}</td>
        <td class="notes">${this.escapeHtml(ln.exit_notes ?? '')}</td>
      </tr>`
        );
      })
      .join('\n');

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
.item{width:18%}
.qty{width:7%; text-align:center}
.state{width:10%}
.notes{width:24%}
</style></head>
<body>
<h1>Inventaire (Entrée + Sortie) — ${this.escapeHtml(lease.unit_code)}</h1>
<div class="small">Bail: ${leaseId} • Session Inventaire: ${invSession.id}</div>

<div class="box">
<b>Logement :</b> ${this.escapeHtml(lease.unit_label)} (${this.escapeHtml(lease.unit_code)})<br/>
${this.escapeHtml(lease.address_line1)}, ${this.escapeHtml(lease.postal_code)} ${this.escapeHtml(lease.city)}<br/>
<b>Locataire :</b> ${this.escapeHtml(lease.tenant_name)}<br/>
<b>Période :</b> ${this.formatDateFr(lease.start_date)} → ${this.formatDateFr(lease.end_date_theoretical)}
</div>

<table>
  <thead>
    <tr>
      <th>Objet</th>
      <th>Entrée<br/>Qté</th>
      <th>Entrée<br/>État</th>
      <th>Entrée<br/>Obs</th>
      <th>Sortie<br/>Qté</th>
      <th>Sortie<br/>État</th>
      <th>Sortie<br/>Obs</th>
    </tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
</table>

<p class="small">Document généré par RentalOS.</p>
</body></html>`;

    const pdfName = `INVENTAIRE_${lease.unit_code}_${this.isoDate(lease.start_date)}.pdf`;
    const outDir = path.join(this.storageBase, 'units', lease.unit_id, 'leases', leaseId, 'documents');
    this.ensureDir(outDir);
    const outPdfPath = path.join(outDir, pdfName);

    const pdfBuf = await this.htmlToPdfBuffer(html);
    fs.writeFileSync(outPdfPath, pdfBuf);

    const sha = this.sha256File(outPdfPath);

    const ins = await this.pool.query(
      `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
       VALUES ($1,$2,'INVENTAIRE',$3,$4,$5) RETURNING *`,
      [lease.unit_id, leaseId, pdfName, outPdfPath.replace(this.storageBase, ''), sha],
    );

    return ins.rows[0];
  }

  // ---------------------------------------------
  // PACK PDF = merge (Contract + Notice if RP + EDL + Inventory)
  // ---------------------------------------------
  async generatePackPdf(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const row = await this.fetchLeaseBundle(leaseId);
    const leaseKind = String(row.kind || 'MEUBLE_RP').toUpperCase() as LeaseKind;

    const contract = await this.generateContractPdf(leaseId);

    let notice: any = null;
    if (leaseKind !== 'SAISONNIER') {
      notice = await this.generateNoticePdf(leaseId);
    }

    const edl = await this.generateEdlPdf(leaseId);
    const inv = await this.generateInventoryPdf(leaseId);

    const contractBuf = fs.readFileSync(path.join(this.storageBase, contract.storage_path));
    const edlBuf = fs.readFileSync(path.join(this.storageBase, edl.storage_path));
    const invBuf = fs.readFileSync(path.join(this.storageBase, inv.storage_path));
    const noticeBuf = notice ? fs.readFileSync(path.join(this.storageBase, notice.storage_path)) : null;

    const parts: Array<{ filename: string; buffer: Buffer }> = [];
    parts.push({ filename: contract.filename, buffer: contractBuf });
    if (noticeBuf) parts.push({ filename: notice.filename, buffer: noticeBuf });
    parts.push({ filename: edl.filename, buffer: edlBuf });
    parts.push({ filename: inv.filename, buffer: invBuf });

    const mergedBuf = await this.mergePdfs(parts);
    const mergedSha = this.sha256Buffer(mergedBuf);

    const pdfName = `PACK_${leaseKind}_${row.unit_code}_${this.isoDate(row.start_date)}.pdf`;
    const outDir = path.join(this.storageBase, 'units', row.unit_id, 'leases', leaseId, 'documents');
    this.ensureDir(outDir);
    const outPdfPath = path.join(outDir, pdfName);
    fs.writeFileSync(outPdfPath, mergedBuf);

    const ins = await this.pool.query(
      `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256)
       VALUES ($1,$2,'PACK',$3,$4,$5) RETURNING *`,
      [row.unit_id, leaseId, pdfName, outPdfPath.replace(this.storageBase, ''), mergedSha],
    );

    return ins.rows[0];
  }

  // ---------------------------------------------
  // Merge PDFs via Gotenberg
  // ---------------------------------------------
  private async mergePdfs(pdfs: Array<{ filename: string; buffer: Buffer }>): Promise<Buffer> {
    const form = new FormData();
    for (const p of pdfs) {
      form.append('files', new Blob([new Uint8Array(p.buffer)], { type: 'application/pdf' }), p.filename);
    }
    const resp = await fetch(`${this.gotenberg}/forms/pdfengines/merge`, { method: 'POST', body: form as any });
    if (!resp.ok) throw new BadRequestException(`PDF merge failed: ${await resp.text()}`);
    return Buffer.from(await resp.arrayBuffer());
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
<b>Signataire :</b> ${signerName} (${signerRole})<br/>
<b>Date :</b> ${signedAtIso}<br/>
</div>

<div class="box">
<b>Signature (image)</b><br/>
<img src="${signatureDataUrl}" alt="signature"/>
</div>

<div class="box small">
<b>Empreinte (SHA-256) du PDF original :</b><br/>
<code>${originalPdfSha256}</code><br/><br/>
<b>Audit :</b><br/>
<pre>${JSON.stringify(auditJson, null, 2)}</pre>
</div>
</body></html>`;

    return await this.htmlToPdfBuffer(html);
  }
async signDocumentMulti(documentId: string, body: any, req: any) {
  const { signerName, signerRole, signatureDataUrl, signerTenantId } = body || {};
  if (!signerName || !signerRole || !signatureDataUrl) {
    throw new BadRequestException('Missing signerName/signerRole/signatureDataUrl');
  }
  if (signerRole !== 'BAILLEUR' && signerRole !== 'LOCATAIRE') {
    throw new BadRequestException('signerRole must be BAILLEUR or LOCATAIRE');
  }

  const docR = await this.pool.query(`SELECT * FROM documents WHERE id=$1`, [documentId]);
  if (!docR.rowCount) throw new BadRequestException('Unknown document');
  const doc = docR.rows[0];

  // ✅ Guard: lease + tenants
  const leaseRow = await this.assertSignableLeaseOrThrow(doc.lease_id);
  const tenants = this.getTenantsFromLeaseRow(leaseRow);

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

  const absPdf = path.join(this.storageBase, doc.storage_path);
  if (!fs.existsSync(absPdf)) throw new BadRequestException('PDF file missing');

  const originalPdfBuf = fs.readFileSync(absPdf);
  const originalSha = this.sha256Buffer(originalPdfBuf);

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
      let latestLandlordSig: any = null;
      for (const s of sigsNow.rows) {
        if (s.signer_role === 'BAILLEUR') {
          if (!latestLandlordSig) latestLandlordSig = s;
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

  const sigDir = path.join(this.storageBase, 'units', doc.unit_id, 'leases', doc.lease_id, 'signatures');
  this.ensureDir(sigDir);

  const sigFile =
    signerRole === 'LOCATAIRE'
      ? `signature_${documentId}_${signerRole}_${effectiveTenantId}_${Date.now()}.png`
      : `signature_${documentId}_${signerRole}_${Date.now()}.png`;

  const sigAbs = path.join(sigDir, sigFile);
  fs.writeFileSync(sigAbs, imgBuf);

  const signedAt = new Date().toISOString();

  // ✅ sequence: locataires d’abord (dans l’ordre tenants_json), bailleur en dernier
  const tenantIndexById = new Map<string, number>();
  tenants.forEach((t: any, idx: number) => {
    const id = String(t?.tenant_id || '').trim();
    if (id) tenantIndexById.set(id, idx);
  });

  const sequence =
    signerRole === 'BAILLEUR'
      ? tenants.length + 1
      : (tenantIndexById.get(effectiveTenantId) ?? 0) + 1;

  const audit = {
    consent: true,
    signedAt,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    documentId,
    signerRole,
    signerName,
    tenantId: signerRole === 'LOCATAIRE' ? effectiveTenantId : null,
    originalPdfSha256: originalSha,
  };

  await this.pool.query(
    `INSERT INTO signatures (document_id, signer_role, signer_name, signature_image_path, ip, user_agent, pdf_sha256, audit_log, sequence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      doc.id,
      signerRole as SignRole,
      signerName,
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

  for (const s of sigs.rows) {
    if (s.signer_role === 'BAILLEUR') {
      if (!latestLandlordSig) latestLandlordSig = s;
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

  if (hasAllTenants && hasLandlord) {
    if (doc.signed_final_document_id) {
      const finalDoc = await this.pool.query(`SELECT * FROM documents WHERE id=$1`, [doc.signed_final_document_id]);
      const finalSignedDocument = finalDoc.rowCount ? finalDoc.rows[0] : null;

      // Option: récupérer signatures existantes pour renvoyer un état cohérent
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
        signaturesPdfSha256: doc.signed_final_sha256 || finalSignedDocument?.sha256 || null,
      };
    }

    const unitQ = await this.pool.query(`SELECT code FROM units WHERE id=$1`, [doc.unit_id]);
    const unitCode = unitQ.rowCount ? unitQ.rows[0].code : 'UNIT';

    const tenantSigsOrdered = tenantIds
      .map((id) => latestTenantSigByTenantId[id])
      .filter(Boolean)
      .sort((a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0));

    const sigOrder: any[] = [...tenantSigsOrdered, latestLandlordSig].filter(Boolean);

    const sigPages: Buffer[] = [];
    for (const s of sigOrder) {
      const sigImgAbs = path.join(this.storageBase, s.signature_image_path);
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
    mergeParts.push({ filename: doc.filename || 'document.pdf', buffer: originalPdfBuf });

    sigOrder.forEach((s: any, idx: number) => {
      if (s.signer_role === 'LOCATAIRE') {
        const tid = this.pickTenantIdFromSignature(s) || `tenant_${idx + 1}`;
        mergeParts.push({ filename: `signature_locataire_${idx + 1}_${tid}.pdf`, buffer: sigPages[idx] });
      } else {
        mergeParts.push({ filename: `signature_bailleur.pdf`, buffer: sigPages[idx] });
      }
    });

    const mergedBuf = await this.mergePdfs(mergeParts);
    const mergedSha = this.sha256Buffer(mergedBuf);

    const signedDir = path.join(this.storageBase, 'units', doc.unit_id, 'leases', doc.lease_id, 'documents');
    this.ensureDir(signedDir);

    const signedName = (doc.filename || 'document.pdf').replace(/\.pdf$/i, '') + `_SIGNED_FINAL.pdf`;
    const signedAbs2 = path.join(signedDir, signedName);
    fs.writeFileSync(signedAbs2, mergedBuf);

    const insDoc = await this.pool.query(
      `INSERT INTO documents (unit_id, lease_id, type, filename, storage_path, sha256, parent_document_id)
       VALUES ($1,$2,'CONTRAT',$3,$4,$5,$6) RETURNING *`,
      [doc.unit_id, doc.lease_id, signedName, signedAbs2.replace(this.storageBase, ''), mergedSha, doc.id],
    );

    await this.pool.query(`UPDATE documents SET signed_final_document_id=$1, finalized_at = NOW(), signed_final_sha256 = $3 WHERE id=$2`, [insDoc.rows[0].id, doc.id, mergedSha]);

    return {
      ok: true,
      pending: false,
      finalSignedDocument: insDoc.rows[0],
      signatures: sigOrder,
      signedPdfSha256: mergedSha,
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
