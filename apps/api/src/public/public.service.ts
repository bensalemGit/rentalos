import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  GoneException,
  ConflictException,
} from '@nestjs/common';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as path from 'path';
import { DocumentsService } from '../documents/documents.service';
import { MailerService } from '../mailer/mailer.service';

@Injectable()
export class PublicService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });
  private storageBase = process.env.STORAGE_BASE_PATH || '/storage';

  constructor(
    private readonly docs: DocumentsService,
    private readonly mailer: MailerService,
  ) {}

  private sha256(s: string) {
    return crypto.createHash('sha256').update(s).digest('hex');
  }

  private randomToken() {
    return crypto.randomBytes(32).toString('base64url');
  }

  private getDownloadGraceMinutes(): number {
    const n = Number(process.env.PUBLIC_LINK_DOWNLOAD_GRACE_MINUTES ?? 30);
    if (!Number.isFinite(n) || n < 0) return 30;
    return Math.floor(n);
  }

  private withinDownloadGrace(consumedAt: any): boolean {
    if (!consumedAt) return true;
    const graceMin = this.getDownloadGraceMinutes();
    if (graceMin === 0) return false;
    const consumedMs = new Date(consumedAt).getTime();
    if (!Number.isFinite(consumedMs)) return false;
    return Date.now() <= consumedMs + graceMin * 60_000;
  }

  private downloadAvailableUntil(consumedAt: any): Date | null {
    if (!consumedAt) return null;
    const graceMin = this.getDownloadGraceMinutes();
    return new Date(new Date(consumedAt).getTime() + graceMin * 60_000);
  }


  private async createPublicLink(args: {
    leaseId: string;
    documentId: string;
    purpose: string; // public_link_purpose
    expiresInHours?: number;
    signerRole?: 'LOCATAIRE' | 'GARANT' | 'BAILLEUR';
    signerTenantId?: string | null;
    signerName?: string | null;
  }) {

    if (!args.leaseId) throw new BadRequestException('Missing leaseId');
    if (!args.documentId) throw new BadRequestException('Missing documentId'); // ✅ NEW
    if (!args.purpose) throw new BadRequestException('Missing purpose'); // ✅ NEW

    const token = this.randomToken();
    const tokenHash = this.sha256(token);
    const hours = args.expiresInHours ?? 72;

    const r = await this.pool.query(
      `
      INSERT INTO public_links
        (token_hash, lease_id, document_id, purpose, expires_at, signer_role, signer_tenant_id, signer_name)
      VALUES
        ($1,$2,$3,$4, NOW() + ($5 || ' hours')::interval, $6, $7, $8)
      RETURNING *
      `,
      [
        tokenHash,
        args.leaseId,
        args.documentId,
        args.purpose,
        String(hours),
        args.signerRole ?? null,
        args.signerTenantId ?? null,
        args.signerName ?? null,
      ],
    );

    return { token, row: r.rows[0] };
  }

  // ✅ Helper: trouver un lien actif (non consommé, non expiré) pour un locataire
  private async findActiveTenantSignLink(leaseId: string, tenantId: string) {
    const q = await this.pool.query(
      `
      SELECT id, expires_at, created_at
      FROM public_links
      WHERE lease_id=$1
        AND purpose='TENANT_SIGN_CONTRACT'
        AND signer_role='LOCATAIRE'
        AND signer_tenant_id=$2
        AND consumed_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId, tenantId],
    );
    return q.rowCount ? q.rows[0] : null;
  }

  // ✅ Helper: supprimer les liens actifs existants (utile pour force=true)
  private async deleteActiveTenantSignLinks(leaseId: string, tenantId: string) {
    await this.pool.query(
      `
      DELETE FROM public_links
      WHERE lease_id=$1
        AND purpose='TENANT_SIGN_CONTRACT'
        AND signer_role='LOCATAIRE'
        AND signer_tenant_id=$2
        AND consumed_at IS NULL
        AND expires_at > NOW()
      `,
      [leaseId, tenantId],
    );
  }

  // ✅ Helper: vérifier si CE locataire a déjà signé CE document
  private async hasTenantAlreadySigned(documentId: string, tenantId: string) {
    const q = await this.pool.query(
      `
      SELECT 1
      FROM signatures s
      WHERE s.document_id = $1
        AND s.signer_role = 'LOCATAIRE'::sign_role
        AND s.signer_tenant_id = $2
      LIMIT 1
      `,
      [documentId, tenantId],
    );
    return q.rowCount > 0;
  }

  private async hasRoleAlreadySigned(documentId: string, role: 'BAILLEUR' | 'GARANT') {
    const q = await this.pool.query(
      `
      SELECT 1
      FROM signatures
      WHERE document_id = $1
        AND UPPER(signer_role) = $2
      LIMIT 1
      `,
      [documentId, role],
    );
    return !!q.rowCount;
  }

  async createTenantSignLink(leaseId: string, ttlHours = 72, purpose = 'TENANT_SIGN_CONTRACT') {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const leaseQ = await this.pool.query(
      `SELECT l.id
       FROM leases l
       WHERE l.id=$1`,
      [leaseId],
    );
    if (!leaseQ.rowCount) throw new BadRequestException('Unknown leaseId');

    const docQ = await this.pool.query(
      `SELECT * FROM documents
       WHERE lease_id=$1 AND type='CONTRAT' AND parent_document_id IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [leaseId],
    );

    let contractDoc = docQ.rowCount ? docQ.rows[0] : null;
    if (!contractDoc) {
      contractDoc = await this.docs.generateContractPdf(leaseId);
    }

    if (contractDoc.signed_final_document_id) {
      throw new ConflictException('Contract already finalized');
    }



    const token = this.randomToken();
    const tokenHash = this.sha256(token);
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();

    await this.pool.query(
      `INSERT INTO public_links (token_hash, lease_id, document_id, purpose, expires_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [tokenHash, leaseId, contractDoc.id, purpose, expiresAt],
    );

    return {
      token,
      expiresAt,
      leaseId,
      documentId: contractDoc.id,
      publicUrl: `https://app.rentalos.fr/public/sign/${token}`,
    };
  }

  async createLandlordSignLink(leaseId: string, ttlHours = 72) {
  // identique à createTenantSignLink()
  const link = await this.createTenantSignLink(leaseId, ttlHours,'LANDLORD_SIGN_CONTRACT');
  return {
    ...link,
    publicUrl: `https://app.rentalos.fr/public/sign/${link.token}?role=landlord`,
  };
}

async createLandlordSignLinkAndEmail(leaseId: string, ttlHours = 72, emailOverride?: string | null) {
  const link = await this.createLandlordSignLink(leaseId, ttlHours);

  const override = emailOverride && String(emailOverride).includes('@') ? String(emailOverride).trim() : '';
  const toEmail = override || process.env.LANDLORD_EMAIL;

  if (!toEmail) throw new BadRequestException('Missing LANDLORD_EMAIL (or use emailOverride)');

  const subject = `Signature bailleur — Contrat de location`;
  const html = `
Bonjour,

Merci de signer le contrat.

Lien de signature :
${link.publicUrl}

Ce lien expire le : ${String(link.expiresAt).slice(0, 19)}

Bien cordialement,
RentalOS
`;
  await this.mailer.sendMail(toEmail, subject, html);
  return { ok: true, ...link, sentTo: toEmail, overrideUsed: !!override };
}
  // ✅ Create + send email to tenant
  // Supports emailOverride (for testing / manual send)
  async createTenantSignLinkAndEmail(
    leaseId: string,
    ttlHours = 72,
    emailOverride?: string | null,
  ) {
    const q = await this.pool.query(
      `SELECT l.id as lease_id, t.email as tenant_email, t.full_name as tenant_name, u.code as unit_code
       FROM leases l
       JOIN tenants t ON t.id = l.tenant_id
       JOIN units u ON u.id = l.unit_id
       WHERE l.id=$1`,
      [leaseId],
    );
    if (!q.rowCount) throw new BadRequestException('Unknown leaseId');

    const row = q.rows[0];

    const override =
      emailOverride && String(emailOverride).includes('@')
        ? String(emailOverride).trim()
        : '';
    const toEmail = override || row.tenant_email;

    if (!toEmail) {
      throw new BadRequestException(
        'Tenant has no email. Please set tenant email first (or use emailOverride).',
      );
    }

    const link = await this.createTenantSignLink(leaseId, ttlHours);

    const subject = `Signature du contrat de location — ${row.unit_code}`;
    const html = `
      <p>Bonjour ${row.tenant_name || ''},</p>
      <p>Merci de signer le contrat de location pour le logement <b>${row.unit_code}</b>.</p>
      <p><b>Lien de signature :</b><br/>
      <a href="${link.publicUrl}">${link.publicUrl}</a></p>
      <p>Ce lien expire le : <b>${String(link.expiresAt).slice(0, 19)}</b></p>
      <p>Bien cordialement,<br/>RentalOS</p>
    `;

    await this.mailer.sendMail(toEmail, subject, html);

    return { ok: true, ...link, sentTo: toEmail, overrideUsed: !!override };
  }


  async sendTenantSignLinks(
    leaseId: string,
    ttlHours = 72,
    emailOverride?: string | null,
    force = false,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    // 1) Find contract root doc (generate if missing)
    const docQ = await this.pool.query(
      `
      SELECT * FROM documents
      WHERE lease_id=$1 AND type='CONTRAT' AND parent_document_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );

    let contractDoc = docQ.rowCount ? docQ.rows[0] : null;
    const contractDocId = String(contractDoc?.id || '').trim();
    if (!contractDocId) {
      // log utile
      // eslint-disable-next-line no-console
      console.error('[sendTenantSignLinks] Missing contractDoc.id', { leaseId, contractDoc });
      throw new BadRequestException('Contract document id missing');
    }
    if (!contractDoc) {
      contractDoc = await this.docs.generateContractPdf(leaseId);
    }

    if (contractDoc.signed_final_document_id) {
      throw new ConflictException('Contract already finalized');
    }

    // 2) Tenants list from lease_tenants
    const tenantsQ = await this.pool.query(
      `
      SELECT tt.id, tt.full_name, tt.email, lt.role, lt.created_at
      FROM lease_tenants lt
      JOIN tenants tt ON tt.id = lt.tenant_id
      WHERE lt.lease_id = $1
      ORDER BY CASE WHEN lt.role='principal' THEN 0 ELSE 1 END, lt.created_at ASC
      `,
      [leaseId],
    );

    if (!tenantsQ.rowCount) throw new BadRequestException('No tenants found for lease');

    const sent: any[] = [];
    const skipped: any[] = [];

    // Optional override (for testing): if provided, send all to that email
    const override =
      emailOverride && String(emailOverride).includes('@')
        ? String(emailOverride).trim()
        : '';

    for (const t of tenantsQ.rows) {
      const tenantId = String(t.id || '').trim();
      if (!tenantId) {
        skipped.push({ tenantId: null, role: t.role, reason: 'missing tenantId' });
        continue;
      }

      const toEmail = override || String(t.email || '').trim();
      if (!toEmail) {
        skipped.push({ tenantId, role: t.role, reason: 'missing email' });
        continue;
      }

      console.log('[sendTenantSignLinks]', {
        leaseId,
        contractDocId: contractDoc.id,
        tenantId,
        email: toEmail,
        role: t.role,
      });

      // ✅ GUARD: si ce locataire a déjà signé => skip (même si pas de lien actif)
      const alreadySigned = await this.hasTenantAlreadySigned(contractDoc.id, tenantId);
      if (alreadySigned && !force) {
        skipped.push({
          tenantId,
          role: t.role,
          email: toEmail,
          reason: 'already_signed',
        });
        continue;
      }

      console.log('[sendTenantSignLinks] alreadySigned?', { tenantId, alreadySigned });

      // ✅ GUARD: si lien actif existe et force=false => skip
      const active = await this.findActiveTenantSignLink(leaseId, tenantId);
      if (active && !force) {
        skipped.push({
          tenantId,
          role: t.role,
          email: toEmail,
          reason: 'active_link_exists',
          activeExpiresAt: active.expires_at,
        });
        continue;
      }

      // ✅ FORCE: si on veut renvoyer, on supprime les liens actifs existants
      if (force) {
        await this.deleteActiveTenantSignLinks(leaseId, tenantId);
      }

      // eslint-disable-next-line no-console
      console.log('[sendTenantSignLinks] createPublicLink args', {
        leaseId,
        contractDocId,
        tenantId,
        purpose: 'TENANT_SIGN_CONTRACT',
      });

      const { token, row } = await this.createPublicLink({
        leaseId,
        documentId: contractDocId,
        purpose: 'TENANT_SIGN_CONTRACT',
        expiresInHours: ttlHours,
        signerRole: 'LOCATAIRE',
        signerTenantId: tenantId,
        signerName: t.full_name,
      });

      const url = `https://app.rentalos.fr/public/sign/${token}`;
      const expiresPretty = new Date(row.expires_at).toLocaleString('fr-FR');

      const subject = `Signature du contrat de location — ${contractDoc.filename || ''}`;
      const html = `
        <p>Bonjour ${t.full_name},</p>

        <p>Merci de signer le contrat de location.</p>

        <p>
          Lien de signature :<br/>
          <a href="${url}">${url}</a>
        </p>

        <p>Ce lien expire le : <b>${expiresPretty}</b></p>

        <p>Bien cordialement,<br/>RentalOS</p>
      `;

      await this.mailer.sendMail(toEmail, subject, html);

      sent.push({
        tenantId,
        role: t.role,
        email: toEmail,
        expiresAt: row.expires_at,
        overrideUsed: !!override,
      });
    }

    return {
      ok: true,
      forceUsed: !!force,
      sentCount: sent.length,
      skippedCount: skipped.length,
      sent,
      skipped,
    };
  }

async sendGuarantorSignLink(
  leaseId: string,
  ttlHours = 72,
  emailOverride?: string | null,
  force = false,
) {
  if (!leaseId) throw new BadRequestException('Missing leaseId');

  // 1) Find guarantor act root doc (generate? -> je garde ton comportement: error si absent)
  const docQ = await this.pool.query(
    `
    SELECT *
    FROM documents
    WHERE lease_id=$1
      AND type='GUARANTOR_ACT'
      AND parent_document_id IS NULL
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [leaseId],
  );
  if (!docQ.rowCount) throw new BadRequestException('No guarantor act document found');

  const actDoc = docQ.rows[0];

  // 2) Get guarantor infos from lease
  const leaseQ = await this.pool.query(
    `SELECT guarantor_full_name, guarantor_email FROM leases WHERE id=$1 LIMIT 1`,
    [leaseId],
  );
  if (!leaseQ.rowCount) throw new BadRequestException('Unknown lease');

  const gName = String(leaseQ.rows[0]?.guarantor_full_name || '').trim();
  const gEmailRaw = String(leaseQ.rows[0]?.guarantor_email || '').trim();

  const override =
    emailOverride && String(emailOverride).includes('@')
      ? String(emailOverride).trim()
      : '';

  const gEmail = override || gEmailRaw;

  if (!gEmail) throw new BadRequestException('Guarantor email missing');
  if (!gName) throw new BadRequestException('Guarantor name missing');

  // 3) ✅ GUARD: si déjà signé => on n'envoie pas
  const alreadySigned = await this.hasGuarantorAlreadySigned(actDoc.id);
  if (alreadySigned) {
    return {
      ok: true,
      forceUsed: !!force,
      sent: false,
      reason: 'already_signed',
      email: gEmail,
    };
  }

  // 4) ✅ GUARD: si lien actif existe et force=false => skip
  const active = await this.findActiveGuarantorSignLink(leaseId);
  if (active && !force) {
    return {
      ok: true,
      forceUsed: !!force,
      sent: false,
      reason: 'active_link_exists',
      email: gEmail,
      activeExpiresAt: active.expires_at,
    };
  }

  // 5) ✅ FORCE => on purge les liens actifs puis on recrée
  if (force) {
    await this.deleteActiveGuarantorSignLinks(leaseId);
  }

  // 6) Create token
  const { token, row } = await this.createPublicLink({
    leaseId,
    documentId: actDoc.id,
    purpose: 'GUARANT_SIGN_ACT',
    expiresInHours: ttlHours,
    signerRole: 'GARANT',
    signerTenantId: null,
    signerName: gName,
  });

  const url = `https://app.rentalos.fr/public/sign/${token}`;
  const expiresPretty = new Date(row.expires_at).toLocaleString('fr-FR');

  // 7) Send email (HTML)
  const subject = `Signature de l'acte de caution — ${actDoc.filename || ''}`;
  const html = `
    <p>Bonjour ${gName},</p>

    <p>Merci de signer l’acte de caution.</p>

    <p>
      Lien de signature :<br/>
      <a href="${url}">${url}</a>
    </p>

    <p>Ce lien expire le : <b>${expiresPretty}</b></p>

    <p>Bien cordialement,<br/>RentalOS</p>
  `;

  await this.mailer.sendMail(gEmail, subject, html);

  return {
    ok: true,
    forceUsed: !!force,
    sent: true,
    email: gEmail,
    expiresAt: row.expires_at,
    overrideUsed: !!override,
  };
}

  // ✅ Helper: vérifier si le garant a déjà signé ce document
private async hasGuarantorAlreadySigned(documentId: string) {
  const q = await this.pool.query(
    `
    SELECT 1
    FROM signatures s
    WHERE s.document_id = $1
      AND s.signer_role = 'GARANT'::sign_role
      AND s.signer_tenant_id IS NULL
    LIMIT 1
    `,
    [documentId],
  );
  return q.rowCount > 0;
}

// ✅ Helper: trouver un lien actif (non consommé, non expiré) pour le garant
private async findActiveGuarantorSignLink(leaseId: string) {
  const q = await this.pool.query(
    `
    SELECT id, expires_at, created_at
    FROM public_links
    WHERE lease_id=$1
      AND purpose='GUARANT_SIGN_ACT'
      AND signer_role='GARANT'
      AND signer_tenant_id IS NULL
      AND consumed_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [leaseId],
  );
  return q.rowCount ? q.rows[0] : null;
}

// ✅ Helper: supprimer le(s) lien(s) actif(s) garant (utile pour force=true)
private async deleteActiveGuarantorSignLinks(leaseId: string) {
  await this.pool.query(
    `
    DELETE FROM public_links
    WHERE lease_id=$1
      AND purpose='GUARANT_SIGN_ACT'
      AND signer_role='GARANT'
      AND signer_tenant_id IS NULL
      AND consumed_at IS NULL
      AND expires_at > NOW()
    `,
    [leaseId],
  );
}

    async resolveToken(
      token: string,
      opts?: { consume?: boolean; allowConsumedWithinGrace?: boolean },
    ): Promise<any> {
    if (!token) throw new UnauthorizedException('Missing token');

    const tokenHash = this.sha256(token);

    const q = await this.pool.query(
      `SELECT pl.*, d.filename, d.storage_path, l.start_date, l.end_date_theoretical,
              u.code as unit_code, t.full_name as tenant_name
       FROM public_links pl
       JOIN documents d ON d.id = pl.document_id
       JOIN leases l ON l.id = pl.lease_id
       JOIN units u ON u.id = l.unit_id
       JOIN tenants t ON t.id = l.tenant_id
       WHERE pl.token_hash=$1`,
      [tokenHash],
    );

    if (!q.rowCount) throw new UnauthorizedException('Invalid token');

    const row = q.rows[0];
    const consume = opts?.consume === true;

    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new GoneException('Link expired');
    }

    // ✅ Si le lien a déjà été consommé (signature faite),
    // on autorise uniquement le download pendant la grace period (si demandé)
    if (!consume && row.consumed_at && opts?.allowConsumedWithinGrace) {
      if (!this.withinDownloadGrace(row.consumed_at)) {
        throw new GoneException('Download window expired');
      }
    }


    // ✅ Ne bloquer "already used" QUE si on est en mode consume:true
    //if (consume && (row.used_count ?? 0) >= 1) {
      //throw new GoneException('Link already used');
    //}

    // ✅ Vérification consommation
    if (consume && row.consumed_at) {
      throw new GoneException('Token already used');
    }

    // ✅ On incrémente used_count uniquement si consume:true
    if (consume) {
      await this.touchUsage(row.id);
      // ✅ Nouveau : on marque consumed_at uniquement si consume=true
    await this.pool.query(
      `UPDATE public_links SET consumed_at=NOW() WHERE id=$1`,
      [row.id]
    );
    row.consumed_at = new Date(); // mettre à jour la copie locale
    }

    return row;
  }

  async touchUsage(id: string) {
    await this.pool.query(
      `UPDATE public_links
       SET used_count = used_count + 1, last_used_at = now()
       WHERE id=$1`,
      [id],
    );
  }

  async invalidateLink(id: string) {
    await this.pool.query(`DELETE FROM public_links WHERE id=$1`, [id]);
  }

  async getPublicInfo(token: string) {
    const row = await this.resolveToken(token, { consume: false });
    return {
      ok: true,
      purpose: row.purpose,
      leaseId: row.lease_id,
      documentId: row.document_id,
      expiresAt: row.expires_at,
      unitCode: row.unit_code,
      tenantName: row.tenant_name,
      startDate: row.start_date,
      endDateTheoretical: row.end_date_theoretical,
      filename: row.filename,

      signerRole: row.signer_role ?? null,
      signerTenantId: row.signer_tenant_id ?? null,
      signerName: row.signer_name ?? null,
      leaseHolderName: row.tenant_name,
      consumedAt: row.consumed_at ?? null,
      downloadGraceMinutes: this.getDownloadGraceMinutes(),
      downloadAvailableUntil: this.downloadAvailableUntil(row.consumed_at)?.toISOString() ?? null,
    };
  }

  async downloadContract(token: string) {
    const row = await this.resolveToken(token, {
      consume: false,
      allowConsumedWithinGrace: true,
    });

    // download depuis page de signature: seulement pour tokens de signature
    const allowed = new Set(['TENANT_SIGN_CONTRACT', 'LANDLORD_SIGN_CONTRACT', 'GUARANT_SIGN_ACT']);
    if (!allowed.has(String(row.purpose || ''))) {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const absPath = path.join(this.storageBase, row.storage_path);
    return { absPath, filename: row.filename };
  }
  
  async publicSign(token: string, body: any, req: any) {
    const row = await this.resolveToken(token, { consume: true });

    // Allow tenant/landlord/guarantor signing tokens
    const allowed = new Set(['TENANT_SIGN_CONTRACT', 'LANDLORD_SIGN_CONTRACT', 'GUARANT_SIGN_ACT']);
    if (!allowed.has(String(row.purpose || ''))) {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const signatureDataUrl = body?.signatureDataUrl;
    if (!signatureDataUrl) {
      throw new BadRequestException('Missing signatureDataUrl');
    }

    // Force signer identity from public_links ONLY (not from client)
    const signerRole = String(row.signer_role || '').toUpperCase();
    if (!signerRole) throw new UnauthorizedException('Missing signer role');
    const signerTenantId = row.signer_tenant_id ?? null;

    const signerName =
      String(row.signer_name || '').trim() ||
      (signerRole === 'BAILLEUR'
        ? process.env.LANDLORD_NAME || 'Bailleur'
        : row.tenant_name || 'Signataire');

    const result = await this.docs.signDocumentMulti(
      row.document_id,
      { signerName, signerRole, signatureDataUrl, signerTenantId },
      req,
    );

    // Keep your current invalidation behavior (delete link)
    //await this.invalidateLink(row.id);

    const until = this.downloadAvailableUntil(row.consumed_at || new Date());
    return {
      ...result,
      downloadGraceMinutes: this.getDownloadGraceMinutes(),
      downloadAvailableUntil: until ? until.toISOString() : null,
    };
  }



  async createFinalPdfDownloadLink(leaseId: string, ttlHours = 72) {
  if (!leaseId) throw new BadRequestException('Missing leaseId');

  const docQ = await this.pool.query(
    `SELECT * FROM documents
     WHERE lease_id=$1 AND type='CONTRAT' AND parent_document_id IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [leaseId],
  );

  if (!docQ.rowCount) throw new BadRequestException('No contract document found');

  const parent = docQ.rows[0];
  if (!parent.signed_final_document_id) {
    throw new BadRequestException('Contract not finalized yet');
  }

  const finalQ = await this.pool.query(
    `SELECT * FROM documents WHERE id=$1`,
    [parent.signed_final_document_id],
  );
  if (!finalQ.rowCount) throw new BadRequestException('Final signed document not found');

  const finalDoc = finalQ.rows[0];

  const token = this.randomToken();
  const tokenHash = this.sha256(token);
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();

  await this.pool.query(
    `INSERT INTO public_links (token_hash, lease_id, document_id, purpose, expires_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [tokenHash, leaseId, finalDoc.id, 'FINAL_PDF_DOWNLOAD', expiresAt],
  );

  return {
    token,
    expiresAt,
    leaseId,
    documentId: finalDoc.id,
    publicUrl: `https://app.rentalos.fr/public/download/${token}`,
  };
}

async downloadFinalPdf(token: string) {
  // 1) resolve sans consommer pour vérifier existence et purpose
  const row = await this.resolveToken(token, { consume: false });

  // 2) vérifier le purpose
  if (String(row.purpose) !== 'FINAL_PDF_DOWNLOAD') {
    throw new UnauthorizedException('Invalid token purpose');
  }

    // 3) si déjà consommé → erreur 410
  if (row.consumed_at) {
    throw new GoneException('Token already used');
  }

  // 4) consommer le token maintenant
  await this.resolveToken(token, { consume: true });

  const absPath = path.join(this.storageBase, row.storage_path);
  return { absPath, filename: row.filename };
}
  async createFinalPackDownloadLink(leaseId: string, ttlHours = 72) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    // Pack final must exist (generated after final signature)
    const packQ = await this.pool.query(
      `SELECT *
       FROM documents
       WHERE lease_id=$1
         AND type='PACK_FINAL'
       ORDER BY created_at DESC
       LIMIT 1`,
      [leaseId],
    );

    if (!packQ.rowCount) {
      throw new BadRequestException('No final pack document found');
    }

    const packDoc = packQ.rows[0];

    const token = this.randomToken();
    const tokenHash = this.sha256(token);
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();

    await this.pool.query(
      `INSERT INTO public_links (token_hash, lease_id, document_id, purpose, expires_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [tokenHash, leaseId, packDoc.id, 'FINAL_PACK_DOWNLOAD', expiresAt],
    );

    return {
      token,
      expiresAt,
      leaseId,
      documentId: packDoc.id,
      publicUrl: `https://app.rentalos.fr/public/download-pack/${token}`,
    };
  }

  async downloadFinalPack(token: string) {
    // 1) resolve without consuming: validate token + purpose
    const row = await this.resolveToken(token, { consume: false });

    if (String(row.purpose) !== 'FINAL_PACK_DOWNLOAD') {
      throw new UnauthorizedException('Invalid token purpose');
    }

    if (row.consumed_at) {
      throw new GoneException('Token already used');
    }

    // 2) consume now (increments + consumed_at)
    await this.resolveToken(token, { consume: true });

    const absPath = path.join(this.storageBase, row.storage_path);
    return { absPath, filename: row.filename };
  }
}
