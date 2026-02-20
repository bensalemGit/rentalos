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

  async resolveToken(token: string, opts?: { consume?: boolean }): Promise<any> {
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
      leaseId: row.lease_id,
      documentId: row.document_id,
      expiresAt: row.expires_at,
      unitCode: row.unit_code,
      tenantName: row.tenant_name,
      startDate: row.start_date,
      endDateTheoretical: row.end_date_theoretical,
      filename: row.filename,
    };
  }

  async downloadContract(token: string) {
    const row = await this.resolveToken(token, { consume: false });
    const absPath = path.join(this.storageBase, row.storage_path);
    return { absPath, filename: row.filename };
  }
  async publicSign(token: string, body: any, req: any) {
    const row = await this.resolveToken(token, { consume: true });
    const allowed = new Set(['TENANT_SIGN_CONTRACT', 'LANDLORD_SIGN_CONTRACT']);
    if (!allowed.has(String(row.purpose || ''))) {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const signerRole = String(body?.signerRole || 'LOCATAIRE').toUpperCase();
    const signatureDataUrl = body?.signatureDataUrl;

    if (!signatureDataUrl) {
      throw new BadRequestException('Missing signatureDataUrl');
    }

    const signerName =
      String(body?.signerName || '').trim() ||
      (signerRole === 'BAILLEUR'
        ? process.env.LANDLORD_NAME || 'Bailleur'
        : row.tenant_name || 'Locataire');

    const signerTenantId = body?.signerTenantId || null;

    const result = await this.docs.signDocumentMulti(
      row.document_id,
      { signerName, signerRole, signatureDataUrl, signerTenantId },
      req,
    );

    await this.invalidateLink(row.id);

    return result;
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
}
