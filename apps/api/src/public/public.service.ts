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
import { promises as fs } from 'fs';

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

  private isUuid(v: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }

  private async resolveLandlordContactByLease(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const q = await this.pool.query(
      `
      SELECT
        p.id AS project_id,
        p.landlord_id,
        p.landlord_profile_id,

        pl.id AS landlord_resolved_id,
        COALESCE(pl.name, lp.name) AS landlord_name,
        COALESCE(pl.email, lp.email) AS landlord_email

      FROM leases l
      JOIN units u ON u.id = l.unit_id
      JOIN projects p ON p.id = u.project_id

      LEFT JOIN project_landlords pl ON pl.id = p.landlord_id
      LEFT JOIN landlord_profiles lp ON lp.id = p.landlord_profile_id

      WHERE l.id = $1
      LIMIT 1
      `,
      [leaseId],
    );

    if (!q.rowCount) {
      throw new BadRequestException('Unable to resolve landlord from lease/project');
    }

    const row = q.rows[0];

    return {
      landlordId: row.landlord_resolved_id ? String(row.landlord_resolved_id).trim() : '',
      landlordProfileId: row.landlord_profile_id ? String(row.landlord_profile_id).trim() : '',
      landlordName: row.landlord_name ? String(row.landlord_name).trim() : null,
      landlordEmail: row.landlord_email ? String(row.landlord_email).trim() : null,
    };
  }


  private async createPublicLink(args: {
    leaseId: string;
    documentId: string;
    purpose: string; // public_link_purpose
    expiresInHours?: number;
    signerRole?: 'LOCATAIRE' | 'GARANT' | 'BAILLEUR';
    signerTenantId?: string | null;
    signerName?: string | null;
    guaranteeId?: string | null;
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
        (token_hash, lease_id, document_id, purpose, expires_at, signer_role, signer_tenant_id, signer_name, guarantee_id)
      VALUES
        ($1,$2,$3,$4, NOW() + ($5 || ' hours')::interval, $6, $7, $8, $9)
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
        args.guaranteeId ?? null,
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
        AND signer_role = ($2)::sign_role
      LIMIT 1
      `,
      [documentId, role],
    );
    return q.rowCount > 0;
  }

  private async findActiveLandlordSignLink(leaseId: string) {
    const q = await this.pool.query(
      `
      SELECT id, expires_at, created_at
      FROM public_links
      WHERE lease_id=$1
        AND purpose='LANDLORD_SIGN_CONTRACT'
        AND signer_role='BAILLEUR'
        AND consumed_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );
    return q.rowCount ? q.rows[0] : null;
  }

  private async deleteActiveLandlordSignLinks(leaseId: string) {
    await this.pool.query(
      `
      DELETE FROM public_links
      WHERE lease_id=$1
        AND purpose='LANDLORD_SIGN_CONTRACT'
        AND signer_role='BAILLEUR'
        AND consumed_at IS NULL
        AND expires_at > NOW()
      `,
      [leaseId],
    );
  }

  private async findActiveEdlEntryTenantLink(leaseId: string, tenantId: string) {
    const q = await this.pool.query(
      `
      SELECT id, expires_at, created_at
      FROM public_links
      WHERE lease_id=$1
        AND purpose='TENANT_SIGN_EDL_ENTRY'
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

  private async deleteActiveEdlEntryTenantLinks(leaseId: string, tenantId: string) {
    await this.pool.query(
      `
      DELETE FROM public_links
      WHERE lease_id=$1
        AND purpose='TENANT_SIGN_EDL_ENTRY'
        AND signer_role='LOCATAIRE'
        AND signer_tenant_id=$2
        AND consumed_at IS NULL
        AND expires_at > NOW()
      `,
      [leaseId, tenantId],
    );
  }

  private async findActiveEdlExitTenantLink(leaseId: string, tenantId: string) {
    const q = await this.pool.query(
      `
      SELECT id, expires_at, created_at
      FROM public_links
      WHERE lease_id=$1
        AND purpose='TENANT_SIGN_EDL_EXIT'
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

  private async deleteActiveEdlExitTenantLinks(leaseId: string, tenantId: string) {
    await this.pool.query(
      `
      DELETE FROM public_links
      WHERE lease_id=$1
        AND purpose='TENANT_SIGN_EDL_EXIT'
        AND signer_role='LOCATAIRE'
        AND signer_tenant_id=$2
        AND consumed_at IS NULL
        AND expires_at > NOW()
      `,
      [leaseId, tenantId],
    );
  }

  private async findActiveInventoryExitTenantLink(leaseId: string, tenantId: string) {
    const q = await this.pool.query(
      `
      SELECT id, expires_at, created_at
      FROM public_links
      WHERE lease_id=$1
        AND purpose='TENANT_SIGN_INVENTORY_EXIT'
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

  private async deleteActiveInventoryExitTenantLinks(leaseId: string, tenantId: string) {
    await this.pool.query(
      `
      DELETE FROM public_links
      WHERE lease_id=$1
        AND purpose='TENANT_SIGN_INVENTORY_EXIT'
        AND signer_role='LOCATAIRE'
        AND signer_tenant_id=$2
        AND consumed_at IS NULL
        AND expires_at > NOW()
      `,
      [leaseId, tenantId],
    );
  }

  private async findActiveEdlExitLandlordLink(leaseId: string) {
    const q = await this.pool.query(
      `
      SELECT id, expires_at, created_at
      FROM public_links
      WHERE lease_id=$1
        AND purpose='LANDLORD_SIGN_EDL_EXIT'
        AND signer_role='BAILLEUR'
        AND consumed_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );
    return q.rowCount ? q.rows[0] : null;
  }

  private async deleteActiveEdlExitLandlordLinks(leaseId: string) {
    await this.pool.query(
      `
      DELETE FROM public_links
      WHERE lease_id=$1
        AND purpose='LANDLORD_SIGN_EDL_EXIT'
        AND signer_role='BAILLEUR'
        AND consumed_at IS NULL
        AND expires_at > NOW()
      `,
      [leaseId],
    );
  }

  private async findActiveInventoryExitLandlordLink(leaseId: string) {
    const q = await this.pool.query(
      `
      SELECT id, expires_at, created_at
      FROM public_links
      WHERE lease_id=$1
        AND purpose='LANDLORD_SIGN_INVENTORY_EXIT'
        AND signer_role='BAILLEUR'
        AND consumed_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );
    return q.rowCount ? q.rows[0] : null;
  }

  private async deleteActiveInventoryExitLandlordLinks(leaseId: string) {
    await this.pool.query(
      `
      DELETE FROM public_links
      WHERE lease_id=$1
        AND purpose='LANDLORD_SIGN_INVENTORY_EXIT'
        AND signer_role='BAILLEUR'
        AND consumed_at IS NULL
        AND expires_at > NOW()
      `,
      [leaseId],
    );
  }

  private async findActiveInventoryEntryTenantLink(leaseId: string, tenantId: string) {
    const q = await this.pool.query(
      `
      SELECT id, expires_at, created_at
      FROM public_links
      WHERE lease_id=$1
        AND purpose='TENANT_SIGN_INVENTORY_ENTRY'
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

  private async deleteActiveInventoryEntryTenantLinks(leaseId: string, tenantId: string) {
    await this.pool.query(
      `
      DELETE FROM public_links
      WHERE lease_id=$1
        AND purpose='TENANT_SIGN_INVENTORY_ENTRY'
        AND signer_role='LOCATAIRE'
        AND signer_tenant_id=$2
        AND consumed_at IS NULL
        AND expires_at > NOW()
      `,
      [leaseId, tenantId],
    );
  }

  private async findActiveEdlEntryLandlordLink(leaseId: string) {
    const q = await this.pool.query(
      `
      SELECT id, expires_at, created_at
      FROM public_links
      WHERE lease_id=$1
        AND purpose='LANDLORD_SIGN_EDL_ENTRY'
        AND signer_role='BAILLEUR'
        AND consumed_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );
    return q.rowCount ? q.rows[0] : null;
  }

  private async deleteActiveEdlEntryLandlordLinks(leaseId: string) {
    await this.pool.query(
      `
      DELETE FROM public_links
      WHERE lease_id=$1
        AND purpose='LANDLORD_SIGN_EDL_ENTRY'
        AND signer_role='BAILLEUR'
        AND consumed_at IS NULL
        AND expires_at > NOW()
      `,
      [leaseId],
    );
  }

  private async findActiveInventoryEntryLandlordLink(leaseId: string) {
    const q = await this.pool.query(
      `
      SELECT id, expires_at, created_at
      FROM public_links
      WHERE lease_id=$1
        AND purpose='LANDLORD_SIGN_INVENTORY_ENTRY'
        AND signer_role='BAILLEUR'
        AND consumed_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );
    return q.rowCount ? q.rows[0] : null;
  }

  private async deleteActiveInventoryEntryLandlordLinks(leaseId: string) {
    await this.pool.query(
      `
      DELETE FROM public_links
      WHERE lease_id=$1
        AND purpose='LANDLORD_SIGN_INVENTORY_ENTRY'
        AND signer_role='BAILLEUR'
        AND consumed_at IS NULL
        AND expires_at > NOW()
      `,
      [leaseId],
    );
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
      const generated = await this.docs.generateContractPdf(leaseId);
      contractDoc = generated?.document ?? generated;
    }

    if (!contractDoc?.id) {
      throw new BadRequestException('Failed to create/find contract document');
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

    async createLandlordSignLink(
    leaseId: string,
    ttlHours = 72,
    force = false,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const docQ = await this.pool.query(
      `SELECT * FROM documents
       WHERE lease_id=$1 AND type='CONTRAT' AND parent_document_id IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [leaseId],
    );

    let contractDoc = docQ.rowCount ? docQ.rows[0] : null;

    if (!contractDoc) {
      const generated = await this.docs.generateContractPdf(leaseId);
      contractDoc = generated?.document ?? generated;
    }

    if (!contractDoc?.id) {
      throw new BadRequestException('Failed to create/find contract document');
    }

    if (contractDoc.signed_final_document_id) {
      throw new ConflictException('Contract already finalized');
    }

    const alreadySigned = await this.hasRoleAlreadySigned(contractDoc.id, 'BAILLEUR');
    if (alreadySigned && !force) {
      throw new ConflictException('Landlord already signed');
    }

    const active = await this.findActiveLandlordSignLink(leaseId);
    if (active && !force) {
      throw new ConflictException('Active landlord sign link already exists');
    }

    if (force) {
      await this.deleteActiveLandlordSignLinks(leaseId);
    }

    const { landlordName } = await this.resolveLandlordContactByLease(leaseId);

    const signerName = landlordName || 'Bailleur';

    const { token, row } = await this.createPublicLink({
      leaseId,
      documentId: contractDoc.id,
      purpose: 'LANDLORD_SIGN_CONTRACT',
      expiresInHours: ttlHours,
      signerRole: 'BAILLEUR',
      signerTenantId: null,
      signerName,
    });

    return {
      token,
      expiresAt: row.expires_at,
      leaseId,
      documentId: contractDoc.id,
      publicUrl: `https://app.rentalos.fr/public/sign/${token}`,
    };
  }

  async createLandlordSignLinkAndEmail(
    leaseId: string,
    ttlHours = 72,
    emailOverride?: string | null,
    force = false,
  ) {
    const link = await this.createLandlordSignLink(leaseId, ttlHours, force);

    const { landlordEmail } = await this.resolveLandlordContactByLease(leaseId);

    const override =
      emailOverride && String(emailOverride).includes('@')
        ? String(emailOverride).trim()
        : '';
    const toEmail = override || landlordEmail;

    if (!toEmail) {
      throw new BadRequestException('Missing landlord email on project (or use emailOverride)');
    }
    const subject = `Signature bailleur — Contrat de location`;
    const html = `
      <p>Bonjour,</p>

      <p>Merci de signer le contrat.</p>

      <p>
        Lien de signature :<br/>
        <a href="${link.publicUrl}">${link.publicUrl}</a>
      </p>

      <p>Ce lien expire le : <b>${String(link.expiresAt).slice(0, 19)}</b></p>

      <p>Bien cordialement,<br/>RentalOS</p>
    `;

    await this.mailer.sendMail(toEmail, subject, html);

    return {
      ok: true,
      ...link,
      sentTo: toEmail,
      overrideUsed: !!override,
      forceUsed: !!force,
    };
  }

  async sendEdlEntryTenantLinks(
    leaseId: string,
    ttlHours = 72,
    emailOverride?: string | null,
    force = false,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const docQ = await this.pool.query(
      `
      SELECT *
      FROM documents
      WHERE lease_id=$1
        AND type='EDL_ENTREE'
        AND parent_document_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );

    if (!docQ.rowCount) {
      throw new BadRequestException('EDL entrée non généré');
    }

    const edlDoc = docQ.rows[0];

    if (edlDoc.signed_final_document_id) {
      throw new ConflictException('EDL entrée already finalized');
    }

    const tenantsQ = await this.pool.query(
      `
      SELECT
        lt.id AS lease_tenant_id,
        lt.tenant_id,
        t.full_name,
        t.email
      FROM lease_tenants lt
      JOIN tenants t ON t.id = lt.tenant_id
      WHERE lt.lease_id=$1
      ORDER BY CASE WHEN lt.role='principal' THEN 0 ELSE 1 END, lt.created_at ASC
      `,
      [leaseId],
    );

    const tenants = tenantsQ.rows || [];
    const sent: any[] = [];
    const skipped: any[] = [];

    for (const tenant of tenants) {
      const tenantId = String(tenant.tenant_id || '').trim();
      if (!tenantId) continue;

      const alreadySigned = await this.hasTenantAlreadySigned(edlDoc.id, tenantId);
      if (alreadySigned && !force) {
        skipped.push({
          tenantId,
          email: tenant.email || null,
          reason: 'already_signed',
        });
        continue;
      }

      const active = await this.findActiveEdlEntryTenantLink(leaseId, tenantId);
      if (active && !force) {
        skipped.push({
          tenantId,
          email: tenant.email || null,
          reason: 'active_link_exists',
        });
        continue;
      }

      if (force) {
        await this.deleteActiveEdlEntryTenantLinks(leaseId, tenantId);
      }

      const toEmail =
        emailOverride && String(emailOverride).includes('@')
          ? String(emailOverride).trim()
          : String(tenant.email || '').trim();

      if (!toEmail) {
        skipped.push({
          tenantId,
          email: null,
          reason: 'missing_email',
        });
        continue;
      }

      const { token, row } = await this.createPublicLink({
        leaseId,
        documentId: edlDoc.id,
        purpose: 'TENANT_SIGN_EDL_ENTRY',
        expiresInHours: ttlHours,
        signerRole: 'LOCATAIRE',
        signerTenantId: tenantId,
        signerName: String(tenant.full_name || 'Locataire').trim(),
      });

      const publicUrl = `https://app.rentalos.fr/public/sign/${token}`;

      await this.mailer.sendMail(
        toEmail,
        'Signature locataire — EDL entrée',
        `
          <p>Bonjour,</p>
          <p>Merci de signer l'état des lieux d'entrée.</p>
          <p><a href="${publicUrl}">${publicUrl}</a></p>
          <p>Ce lien expire le : <b>${String(row.expires_at).slice(0, 19)}</b></p>
        `,
      );

      sent.push({
        tenantId,
        email: toEmail,
        expiresAt: row.expires_at,
      });
    }

    return {
      ok: true,
      sent,
      skipped,
      sentCount: sent.length,
      skippedCount: skipped.length,
      forceUsed: !!force,
      documentId: edlDoc.id,
    };
  }

    async sendInventoryEntryTenantLinks(
    leaseId: string,
    ttlHours = 72,
    emailOverride?: string | null,
    force = false,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const docQ = await this.pool.query(
      `
      SELECT *
      FROM documents
      WHERE lease_id=$1
        AND type='INVENTAIRE_ENTREE'
        AND parent_document_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );

    if (!docQ.rowCount) {
      throw new BadRequestException('Inventaire entrée non généré');
    }

    const inventoryDoc = docQ.rows[0];

    if (inventoryDoc.signed_final_document_id) {
      throw new ConflictException('Inventaire entrée already finalized');
    }

    const tenantsQ = await this.pool.query(
      `
      SELECT
        lt.id AS lease_tenant_id,
        lt.tenant_id,
        t.full_name,
        t.email
      FROM lease_tenants lt
      JOIN tenants t ON t.id = lt.tenant_id
      WHERE lt.lease_id=$1
      ORDER BY CASE WHEN lt.role='principal' THEN 0 ELSE 1 END, lt.created_at ASC
      `,
      [leaseId],
    );

    const tenants = tenantsQ.rows || [];
    const sent: any[] = [];
    const skipped: any[] = [];

    for (const tenant of tenants) {
      const tenantId = String(tenant.tenant_id || '').trim();
      if (!tenantId) continue;

      const alreadySigned = await this.hasTenantAlreadySigned(inventoryDoc.id, tenantId);
      if (alreadySigned && !force) {
        skipped.push({
          tenantId,
          email: tenant.email || null,
          reason: 'already_signed',
        });
        continue;
      }

      const active = await this.findActiveInventoryEntryTenantLink(leaseId, tenantId);
      if (active && !force) {
        skipped.push({
          tenantId,
          email: tenant.email || null,
          reason: 'active_link_exists',
        });
        continue;
      }

      if (force) {
        await this.deleteActiveInventoryEntryTenantLinks(leaseId, tenantId);
      }

      const toEmail =
        emailOverride && String(emailOverride).includes('@')
          ? String(emailOverride).trim()
          : String(tenant.email || '').trim();

      if (!toEmail) {
        skipped.push({
          tenantId,
          email: null,
          reason: 'missing_email',
        });
        continue;
      }

      const { token, row } = await this.createPublicLink({
        leaseId,
        documentId: inventoryDoc.id,
        purpose: 'TENANT_SIGN_INVENTORY_ENTRY',
        expiresInHours: ttlHours,
        signerRole: 'LOCATAIRE',
        signerTenantId: tenantId,
        signerName: String(tenant.full_name || 'Locataire').trim(),
      });

      const publicUrl = `https://app.rentalos.fr/public/sign/${token}`;

      await this.mailer.sendMail(
        toEmail,
        'Signature locataire — Inventaire entrée',
        `
          <p>Bonjour,</p>
          <p>Merci de signer l'inventaire d'entrée.</p>
          <p><a href="${publicUrl}">${publicUrl}</a></p>
          <p>Ce lien expire le : <b>${String(row.expires_at).slice(0, 19)}</b></p>
        `,
      );

      sent.push({
        tenantId,
        email: toEmail,
        expiresAt: row.expires_at,
      });
    }

    return {
      ok: true,
      sent,
      skipped,
      sentCount: sent.length,
      skippedCount: skipped.length,
      forceUsed: !!force,
      documentId: inventoryDoc.id,
    };
  }

  async createEdlEntryLandlordLink(
    leaseId: string,
    ttlHours = 72,
    force = false,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const docQ = await this.pool.query(
      `
      SELECT *
      FROM documents
      WHERE lease_id=$1
        AND type='EDL_ENTREE'
        AND parent_document_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );

    if (!docQ.rowCount) {
      throw new BadRequestException('EDL entrée non généré');
    }

    const edlDoc = docQ.rows[0];

    if (edlDoc.signed_final_document_id) {
      throw new ConflictException('EDL entrée already finalized');
    }

    const alreadySigned = await this.hasRoleAlreadySigned(edlDoc.id, 'BAILLEUR');
    if (alreadySigned && !force) {
      throw new ConflictException('Landlord already signed EDL entry');
    }

    const active = await this.findActiveEdlEntryLandlordLink(leaseId);
    if (active && !force) {
      throw new ConflictException('Active landlord EDL entry sign link already exists');
    }

    if (force) {
      await this.deleteActiveEdlEntryLandlordLinks(leaseId);
    }

    const { landlordName } = await this.resolveLandlordContactByLease(leaseId);

    const signerName = landlordName || 'Bailleur';

    const { token, row } = await this.createPublicLink({
      leaseId,
      documentId: edlDoc.id,
      purpose: 'LANDLORD_SIGN_EDL_ENTRY',
      expiresInHours: ttlHours,
      signerRole: 'BAILLEUR',
      signerTenantId: null,
      signerName,
    });

    return {
      token,
      expiresAt: row.expires_at,
      leaseId,
      documentId: edlDoc.id,
      publicUrl: `https://app.rentalos.fr/public/sign/${token}`,
    };
  }

  async createEdlEntryLandlordLinkAndEmail(
    leaseId: string,
    ttlHours = 72,
    emailOverride?: string | null,
    force = false,
  ) {
    const link = await this.createEdlEntryLandlordLink(leaseId, ttlHours, force);

    const { landlordEmail } = await this.resolveLandlordContactByLease(leaseId);

    const override =
      emailOverride && String(emailOverride).includes('@')
        ? String(emailOverride).trim()
        : '';
    const toEmail = override || landlordEmail;

    if (!toEmail) {
      throw new BadRequestException('Missing landlord email on project (or use emailOverride)');
    }

    await this.mailer.sendMail(
      toEmail,
      'Signature bailleur — EDL entrée',
      `
        <p>Bonjour,</p>
        <p>Merci de signer l'état des lieux d'entrée.</p>
        <p><a href="${link.publicUrl}">${link.publicUrl}</a></p>
        <p>Ce lien expire le : <b>${String(link.expiresAt).slice(0, 19)}</b></p>
      `,
    );

    return {
      ok: true,
      ...link,
      sentTo: toEmail,
      overrideUsed: !!override,
      forceUsed: !!force,
    };
  }

  async createEdlExitLandlordLink(
    leaseId: string,
    ttlHours = 72,
    force = false,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const docQ = await this.pool.query(
      `
      SELECT *
      FROM documents
      WHERE lease_id=$1
        AND type='EDL_SORTIE'
        AND parent_document_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );

    if (!docQ.rowCount) {
      throw new BadRequestException('EDL sortie non généré');
    }

    const edlDoc = docQ.rows[0];

    if (edlDoc.signed_final_document_id) {
      throw new ConflictException('EDL sortie already finalized');
    }

    const alreadySigned = await this.hasRoleAlreadySigned(edlDoc.id, 'BAILLEUR');
    if (alreadySigned && !force) {
      throw new ConflictException('Landlord already signed EDL exit');
    }

    const active = await this.findActiveEdlExitLandlordLink(leaseId);
    if (active && !force) {
      throw new ConflictException('Active landlord EDL exit sign link already exists');
    }

    if (force) {
      await this.deleteActiveEdlExitLandlordLinks(leaseId);
    }

    const { landlordName } = await this.resolveLandlordContactByLease(leaseId);
    const signerName = landlordName || 'Bailleur';

    const { token, row } = await this.createPublicLink({
      leaseId,
      documentId: edlDoc.id,
      purpose: 'LANDLORD_SIGN_EDL_EXIT',
      expiresInHours: ttlHours,
      signerRole: 'BAILLEUR',
      signerTenantId: null,
      signerName,
    });

    return {
      token,
      expiresAt: row.expires_at,
      leaseId,
      documentId: edlDoc.id,
      publicUrl: `https://app.rentalos.fr/public/sign/${token}`,
    };
  }

  async createEdlExitLandlordLinkAndEmail(
    leaseId: string,
    ttlHours = 72,
    emailOverride?: string | null,
    force = false,
  ) {
    const link = await this.createEdlExitLandlordLink(leaseId, ttlHours, force);

    const { landlordEmail } = await this.resolveLandlordContactByLease(leaseId);

    const override =
      emailOverride && String(emailOverride).includes('@')
        ? String(emailOverride).trim()
        : '';
    const toEmail = override || landlordEmail;

    if (!toEmail) {
      throw new BadRequestException('Missing landlord email on project (or use emailOverride)');
    }

    await this.mailer.sendMail(
      toEmail,
      'Signature bailleur — EDL sortie',
      `
        <p>Bonjour,</p>
        <p>Merci de signer l'état des lieux de sortie.</p>
        <p><a href="${link.publicUrl}">${link.publicUrl}</a></p>
        <p>Ce lien expire le : <b>${String(link.expiresAt).slice(0, 19)}</b></p>
      `,
    );

    return {
      ok: true,
      ...link,
      sentTo: toEmail,
      overrideUsed: !!override,
      forceUsed: !!force,
    };
  }

  async createInventoryEntryLandlordLink(
    leaseId: string,
    ttlHours = 72,
    force = false,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const docQ = await this.pool.query(
      `
      SELECT *
      FROM documents
      WHERE lease_id=$1
        AND type='INVENTAIRE_ENTREE'
        AND parent_document_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );

    if (!docQ.rowCount) {
      throw new BadRequestException('Inventaire entrée non généré');
    }

    const inventoryDoc = docQ.rows[0];

    if (inventoryDoc.signed_final_document_id) {
      throw new ConflictException('Inventaire entrée already finalized');
    }

    const alreadySigned = await this.hasRoleAlreadySigned(inventoryDoc.id, 'BAILLEUR');
    if (alreadySigned && !force) {
      throw new ConflictException('Landlord already signed inventory entry');
    }

    const active = await this.findActiveInventoryEntryLandlordLink(leaseId);
    if (active && !force) {
      throw new ConflictException('Active landlord inventory entry sign link already exists');
    }

    if (force) {
      await this.deleteActiveInventoryEntryLandlordLinks(leaseId);
    }

    const { landlordName } = await this.resolveLandlordContactByLease(leaseId);
    const signerName = landlordName || 'Bailleur';

    const { token, row } = await this.createPublicLink({
      leaseId,
      documentId: inventoryDoc.id,
      purpose: 'LANDLORD_SIGN_INVENTORY_ENTRY',
      expiresInHours: ttlHours,
      signerRole: 'BAILLEUR',
      signerTenantId: null,
      signerName,
    });

    return {
      token,
      expiresAt: row.expires_at,
      leaseId,
      documentId: inventoryDoc.id,
      publicUrl: `https://app.rentalos.fr/public/sign/${token}`,
    };
  }

  async createInventoryEntryLandlordLinkAndEmail(
    leaseId: string,
    ttlHours = 72,
    emailOverride?: string | null,
    force = false,
  ) {
    const link = await this.createInventoryEntryLandlordLink(leaseId, ttlHours, force);

    const { landlordEmail } = await this.resolveLandlordContactByLease(leaseId);

    const override =
      emailOverride && String(emailOverride).includes('@')
        ? String(emailOverride).trim()
        : '';
    const toEmail = override || landlordEmail;

    if (!toEmail) {
      throw new BadRequestException('Missing landlord email on project (or use emailOverride)');
    }

    await this.mailer.sendMail(
      toEmail,
      'Signature bailleur — Inventaire entrée',
      `
        <p>Bonjour,</p>
        <p>Merci de signer l'inventaire d'entrée.</p>
        <p><a href="${link.publicUrl}">${link.publicUrl}</a></p>
        <p>Ce lien expire le : <b>${String(link.expiresAt).slice(0, 19)}</b></p>
      `,
    );

    return {
      ok: true,
      ...link,
      sentTo: toEmail,
      overrideUsed: !!override,
      forceUsed: !!force,
    };
  }

  async createInventoryExitLandlordLink(
    leaseId: string,
    ttlHours = 72,
    force = false,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');

    const docQ = await this.pool.query(
      `
      SELECT *
      FROM documents
      WHERE lease_id=$1
        AND type='INVENTAIRE_SORTIE'
        AND parent_document_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );

    if (!docQ.rowCount) {
      throw new BadRequestException('Inventaire sortie non généré');
    }

    const inventoryDoc = docQ.rows[0];

    if (inventoryDoc.signed_final_document_id) {
      throw new ConflictException('Inventaire sortie already finalized');
    }

    const alreadySigned = await this.hasRoleAlreadySigned(inventoryDoc.id, 'BAILLEUR');
    if (alreadySigned && !force) {
      throw new ConflictException('Landlord already signed inventory exit');
    }

    const active = await this.findActiveInventoryExitLandlordLink(leaseId);
    if (active && !force) {
      throw new ConflictException('Active landlord inventory exit sign link already exists');
    }

    if (force) {
      await this.deleteActiveInventoryExitLandlordLinks(leaseId);
    }

    const { landlordName } = await this.resolveLandlordContactByLease(leaseId);
    const signerName = landlordName || 'Bailleur';

    const { token, row } = await this.createPublicLink({
      leaseId,
      documentId: inventoryDoc.id,
      purpose: 'LANDLORD_SIGN_INVENTORY_EXIT',
      expiresInHours: ttlHours,
      signerRole: 'BAILLEUR',
      signerTenantId: null,
      signerName,
    });

    return {
      token,
      expiresAt: row.expires_at,
      leaseId,
      documentId: inventoryDoc.id,
      publicUrl: `https://app.rentalos.fr/public/sign/${token}`,
    };
  }

  async createInventoryExitLandlordLinkAndEmail(
    leaseId: string,
    ttlHours = 72,
    emailOverride?: string | null,
    force = false,
  ) {
    const link = await this.createInventoryExitLandlordLink(leaseId, ttlHours, force);

    const { landlordEmail } = await this.resolveLandlordContactByLease(leaseId);

    const override =
      emailOverride && String(emailOverride).includes('@')
        ? String(emailOverride).trim()
        : '';
    const toEmail = override || landlordEmail;

    if (!toEmail) {
      throw new BadRequestException('Missing landlord email on project (or use emailOverride)');
    }

    await this.mailer.sendMail(
      toEmail,
      'Signature bailleur — Inventaire sortie',
      `
        <p>Bonjour,</p>
        <p>Merci de signer l'inventaire de sortie.</p>
        <p><a href="${link.publicUrl}">${link.publicUrl}</a></p>
        <p>Ce lien expire le : <b>${String(link.expiresAt).slice(0, 19)}</b></p>
      `,
    );

    return {
      ok: true,
      ...link,
      sentTo: toEmail,
      overrideUsed: !!override,
      forceUsed: !!force,
    };
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

  async createTenantContractLinkAndEmail(
    leaseId: string,
    tenantId: string,
    ttlHours = 72,
    emailOverride?: string | null,
    force = false,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    if (!tenantId) throw new BadRequestException('Missing tenantId');

    const docQ = await this.pool.query(
      `
      SELECT *
      FROM documents
      WHERE lease_id=$1
        AND type='CONTRAT'
        AND parent_document_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );

    let contractDoc = docQ.rowCount ? docQ.rows[0] : null;

    if (!contractDoc) {
      const generated = await this.docs.generateContractPdf(leaseId);
      contractDoc = generated?.document ?? generated;
    }

    if (!contractDoc?.id) {
      throw new BadRequestException('Failed to create/find contract document');
    }

    if (contractDoc.signed_final_document_id) {
      throw new ConflictException('Contract already finalized');
    }

    const tenantQ = await this.pool.query(
      `
      SELECT
        tt.id,
        tt.full_name,
        tt.email,
        lt.role
      FROM lease_tenants lt
      JOIN tenants tt ON tt.id = lt.tenant_id
      WHERE lt.lease_id = $1
        AND lt.tenant_id = $2
      LIMIT 1
      `,
      [leaseId, tenantId],
    );

    if (!tenantQ.rowCount) {
      throw new BadRequestException('Tenant not found on lease');
    }

    const tenant = tenantQ.rows[0];

    const alreadySigned = await this.hasTenantAlreadySigned(contractDoc.id, tenantId);
    if (alreadySigned && !force) {
      throw new ConflictException('Tenant already signed');
    }

    const active = await this.findActiveTenantSignLink(leaseId, tenantId);
    if (active && !force) {
      throw new ConflictException('Active tenant sign link already exists');
    }

    if (force) {
      await this.deleteActiveTenantSignLinks(leaseId, tenantId);
    }

    const override =
      emailOverride && String(emailOverride).includes('@')
        ? String(emailOverride).trim()
        : '';

    const toEmail = override || String(tenant.email || '').trim();

    if (!toEmail) {
      throw new BadRequestException(
        'Tenant has no email. Please set tenant email first (or use emailOverride).',
      );
    }

    const signerName = String(tenant.full_name || 'Locataire').trim();

    const { token, row } = await this.createPublicLink({
      leaseId,
      documentId: contractDoc.id,
      purpose: 'TENANT_SIGN_CONTRACT',
      expiresInHours: ttlHours,
      signerRole: 'LOCATAIRE',
      signerTenantId: tenantId,
      signerName,
    });

    const publicUrl = `https://app.rentalos.fr/public/sign/${token}`;

    await this.mailer.sendMail(
      toEmail,
      `Signature du contrat de location — ${contractDoc.filename || ''}`,
      `
        <p>Bonjour ${signerName},</p>
        <p>Merci de signer le contrat de location.</p>
        <p><a href="${publicUrl}">${publicUrl}</a></p>
        <p>Ce lien expire le : <b>${String(row.expires_at).slice(0, 19)}</b></p>
        <p>Bien cordialement,<br/>RentalOS</p>
      `,
    );

    return {
      ok: true,
      token,
      expiresAt: row.expires_at,
      leaseId,
      documentId: contractDoc.id,
      publicUrl,
      sentTo: toEmail,
      tenantId,
      role: tenant.role ?? null,
      forceUsed: !!force,
      overrideUsed: !!override,
    };
  }

  async createEdlEntryTenantLinkAndEmail(
    leaseId: string,
    tenantId: string,
    ttlHours = 72,
    emailOverride?: string | null,
    force = false,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    if (!tenantId) throw new BadRequestException('Missing tenantId');

    const docQ = await this.pool.query(
      `
      SELECT *
      FROM documents
      WHERE lease_id=$1
        AND type='EDL_ENTREE'
        AND parent_document_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );

    if (!docQ.rowCount) {
      throw new BadRequestException('EDL entrée non généré');
    }

    const edlDoc = docQ.rows[0];

    if (edlDoc.signed_final_document_id) {
      throw new ConflictException('EDL entrée already finalized');
    }

    const tenantQ = await this.pool.query(
      `
      SELECT
        tt.id,
        tt.full_name,
        tt.email,
        lt.role
      FROM lease_tenants lt
      JOIN tenants tt ON tt.id = lt.tenant_id
      WHERE lt.lease_id = $1
        AND lt.tenant_id = $2
      LIMIT 1
      `,
      [leaseId, tenantId],
    );

    if (!tenantQ.rowCount) {
      throw new BadRequestException('Tenant not found on lease');
    }

    const tenant = tenantQ.rows[0];

    const alreadySigned = await this.hasTenantAlreadySigned(edlDoc.id, tenantId);
    if (alreadySigned && !force) {
      throw new ConflictException('Tenant already signed EDL entry');
    }

    const active = await this.findActiveEdlEntryTenantLink(leaseId, tenantId);
    if (active && !force) {
      throw new ConflictException('Active tenant EDL entry sign link already exists');
    }

    if (force) {
      await this.deleteActiveEdlEntryTenantLinks(leaseId, tenantId);
    }

    const override =
      emailOverride && String(emailOverride).includes('@')
        ? String(emailOverride).trim()
        : '';

    const toEmail = override || String(tenant.email || '').trim();

    if (!toEmail) {
      throw new BadRequestException(
        'Tenant has no email. Please set tenant email first (or use emailOverride).',
      );
    }

    const signerName = String(tenant.full_name || 'Locataire').trim();

    const { token, row } = await this.createPublicLink({
      leaseId,
      documentId: edlDoc.id,
      purpose: 'TENANT_SIGN_EDL_ENTRY',
      expiresInHours: ttlHours,
      signerRole: 'LOCATAIRE',
      signerTenantId: tenantId,
      signerName,
    });

    const publicUrl = `https://app.rentalos.fr/public/sign/${token}`;

    await this.mailer.sendMail(
      toEmail,
      `Signature locataire — EDL entrée`,
      `
        <p>Bonjour ${signerName},</p>
        <p>Merci de signer l'état des lieux d'entrée.</p>
        <p><a href="${publicUrl}">${publicUrl}</a></p>
        <p>Ce lien expire le : <b>${String(row.expires_at).slice(0, 19)}</b></p>
        <p>Bien cordialement,<br/>RentalOS</p>
      `,
    );

    return {
      ok: true,
      token,
      expiresAt: row.expires_at,
      leaseId,
      documentId: edlDoc.id,
      publicUrl,
      sentTo: toEmail,
      tenantId,
      role: tenant.role ?? null,
      forceUsed: !!force,
      overrideUsed: !!override,
    };
  }

  async createInventoryEntryTenantLinkAndEmail(
    leaseId: string,
    tenantId: string,
    ttlHours = 72,
    emailOverride?: string | null,
    force = false,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    if (!tenantId) throw new BadRequestException('Missing tenantId');

    const docQ = await this.pool.query(
      `
      SELECT *
      FROM documents
      WHERE lease_id=$1
        AND type='INVENTAIRE_ENTREE'
        AND parent_document_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );

    if (!docQ.rowCount) {
      throw new BadRequestException('Inventaire entrée non généré');
    }

    const inventoryDoc = docQ.rows[0];

    if (inventoryDoc.signed_final_document_id) {
      throw new ConflictException('Inventaire entrée already finalized');
    }

    const tenantQ = await this.pool.query(
      `
      SELECT
        tt.id,
        tt.full_name,
        tt.email,
        lt.role
      FROM lease_tenants lt
      JOIN tenants tt ON tt.id = lt.tenant_id
      WHERE lt.lease_id = $1
        AND lt.tenant_id = $2
      LIMIT 1
      `,
      [leaseId, tenantId],
    );

    if (!tenantQ.rowCount) {
      throw new BadRequestException('Tenant not found on lease');
    }

    const tenant = tenantQ.rows[0];

    const alreadySigned = await this.hasTenantAlreadySigned(inventoryDoc.id, tenantId);
    if (alreadySigned && !force) {
      throw new ConflictException('Tenant already signed inventory entry');
    }

    const active = await this.findActiveInventoryEntryTenantLink(leaseId, tenantId);
    if (active && !force) {
      throw new ConflictException('Active tenant inventory entry sign link already exists');
    }

    if (force) {
      await this.deleteActiveInventoryEntryTenantLinks(leaseId, tenantId);
    }

    const override =
      emailOverride && String(emailOverride).includes('@')
        ? String(emailOverride).trim()
        : '';

    const toEmail = override || String(tenant.email || '').trim();

    if (!toEmail) {
      throw new BadRequestException(
        'Tenant has no email. Please set tenant email first (or use emailOverride).',
      );
    }

    const signerName = String(tenant.full_name || 'Locataire').trim();

    const { token, row } = await this.createPublicLink({
      leaseId,
      documentId: inventoryDoc.id,
      purpose: 'TENANT_SIGN_INVENTORY_ENTRY',
      expiresInHours: ttlHours,
      signerRole: 'LOCATAIRE',
      signerTenantId: tenantId,
      signerName,
    });

    const publicUrl = `https://app.rentalos.fr/public/sign/${token}`;

    await this.mailer.sendMail(
      toEmail,
      `Signature locataire — Inventaire entrée`,
      `
        <p>Bonjour ${signerName},</p>
        <p>Merci de signer l'inventaire d'entrée.</p>
        <p><a href="${publicUrl}">${publicUrl}</a></p>
        <p>Ce lien expire le : <b>${String(row.expires_at).slice(0, 19)}</b></p>
        <p>Bien cordialement,<br/>RentalOS</p>
      `,
    );

    return {
      ok: true,
      token,
      expiresAt: row.expires_at,
      leaseId,
      documentId: inventoryDoc.id,
      publicUrl,
      sentTo: toEmail,
      tenantId,
      role: tenant.role ?? null,
      forceUsed: !!force,
      overrideUsed: !!override,
    };
  }

  async createInventoryExitTenantLinkAndEmail(
    leaseId: string,
    tenantId: string,
    ttlHours = 72,
    emailOverride?: string | null,
    force = false,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    if (!tenantId) throw new BadRequestException('Missing tenantId');

    const docQ = await this.pool.query(
      `
      SELECT *
      FROM documents
      WHERE lease_id=$1
        AND type='INVENTAIRE_SORTIE'
        AND parent_document_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );

    if (!docQ.rowCount) {
      throw new BadRequestException('Inventaire sortie non généré');
    }

    const inventoryDoc = docQ.rows[0];

    if (inventoryDoc.signed_final_document_id) {
      throw new ConflictException('Inventaire sortie already finalized');
    }

    const tenantQ = await this.pool.query(
      `
      SELECT
        tt.id,
        tt.full_name,
        tt.email,
        lt.role
      FROM lease_tenants lt
      JOIN tenants tt ON tt.id = lt.tenant_id
      WHERE lt.lease_id = $1
        AND lt.tenant_id = $2
      LIMIT 1
      `,
      [leaseId, tenantId],
    );

    if (!tenantQ.rowCount) {
      throw new BadRequestException('Tenant not found on lease');
    }

    const tenant = tenantQ.rows[0];

    const alreadySigned = await this.hasTenantAlreadySigned(inventoryDoc.id, tenantId);
    if (alreadySigned && !force) {
      throw new ConflictException('Tenant already signed inventory exit');
    }

    const active = await this.findActiveInventoryExitTenantLink(leaseId, tenantId);
    if (active && !force) {
      throw new ConflictException('Active tenant inventory exit sign link already exists');
    }

    if (force) {
      await this.deleteActiveInventoryExitTenantLinks(leaseId, tenantId);
    }

    const override =
      emailOverride && String(emailOverride).includes('@')
        ? String(emailOverride).trim()
        : '';

    const toEmail = override || String(tenant.email || '').trim();

    if (!toEmail) {
      throw new BadRequestException(
        'Tenant has no email. Please set tenant email first (or use emailOverride).',
      );
    }

    const signerName = String(tenant.full_name || 'Locataire').trim();

    const { token, row } = await this.createPublicLink({
      leaseId,
      documentId: inventoryDoc.id,
      purpose: 'TENANT_SIGN_INVENTORY_EXIT',
      expiresInHours: ttlHours,
      signerRole: 'LOCATAIRE',
      signerTenantId: tenantId,
      signerName,
    });

    const publicUrl = `https://app.rentalos.fr/public/sign/${token}`;

    await this.mailer.sendMail(
      toEmail,
      `Signature locataire — Inventaire sortie`,
      `
        <p>Bonjour ${signerName},</p>
        <p>Merci de signer l'inventaire de sortie.</p>
        <p><a href="${publicUrl}">${publicUrl}</a></p>
        <p>Ce lien expire le : <b>${String(row.expires_at).slice(0, 19)}</b></p>
        <p>Bien cordialement,<br/>RentalOS</p>
      `,
    );

    return {
      ok: true,
      token,
      expiresAt: row.expires_at,
      leaseId,
      documentId: inventoryDoc.id,
      publicUrl,
      sentTo: toEmail,
      tenantId,
      role: tenant.role ?? null,
      forceUsed: !!force,
      overrideUsed: !!override,
    };
  }

  async createEdlExitTenantLinkAndEmail(
    leaseId: string,
    tenantId: string,
    ttlHours = 72,
    emailOverride?: string | null,
    force = false,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    if (!tenantId) throw new BadRequestException('Missing tenantId');

    const docQ = await this.pool.query(
      `
      SELECT *
      FROM documents
      WHERE lease_id=$1
        AND type='EDL_SORTIE'
        AND parent_document_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [leaseId],
    );

    if (!docQ.rowCount) {
      throw new BadRequestException('EDL sortie non généré');
    }

    const edlDoc = docQ.rows[0];

    if (edlDoc.signed_final_document_id) {
      throw new ConflictException('EDL sortie already finalized');
    }

    const tenantQ = await this.pool.query(
      `
      SELECT
        tt.id AS tenant_id,
        tt.full_name,
        tt.email,
        lt.role
      FROM lease_tenants lt
      JOIN tenants tt ON tt.id = lt.tenant_id
      WHERE lt.lease_id = $1
        AND tt.id = $2
      LIMIT 1
      `,
      [leaseId, tenantId],
    );

    if (!tenantQ.rowCount) {
      throw new BadRequestException('Tenant not found for lease');
    }

    const tenant = tenantQ.rows[0];

    const alreadySigned = await this.hasTenantAlreadySigned(edlDoc.id, tenantId);
    if (alreadySigned && !force) {
      throw new ConflictException('Tenant already signed EDL exit');
    }

    const active = await this.findActiveEdlExitTenantLink(leaseId, tenantId);
    if (active && !force) {
      throw new ConflictException('Active tenant EDL exit sign link already exists');
    }

    if (force) {
      await this.deleteActiveEdlExitTenantLinks(leaseId, tenantId);
    }

    const override =
      emailOverride && String(emailOverride).includes('@')
        ? String(emailOverride).trim()
        : '';

    const toEmail = override || String(tenant.email || '').trim();

    if (!toEmail) {
      throw new BadRequestException('Tenant email missing (or use emailOverride)');
    }

    const { token, row } = await this.createPublicLink({
      leaseId,
      documentId: edlDoc.id,
      purpose: 'TENANT_SIGN_EDL_EXIT',
      expiresInHours: ttlHours,
      signerRole: 'LOCATAIRE',
      signerTenantId: tenantId,
      signerName: String(tenant.full_name || 'Locataire').trim(),
    });

    const publicUrl = `https://app.rentalos.fr/public/sign/${token}`;

    await this.mailer.sendMail(
      toEmail,
      'Signature locataire — EDL sortie',
      `
        <p>Bonjour,</p>
        <p>Merci de signer l'état des lieux de sortie.</p>
        <p><a href="${publicUrl}">${publicUrl}</a></p>
        <p>Ce lien expire le : <b>${String(row.expires_at).slice(0, 19)}</b></p>
      `,
    );

    return {
      ok: true,
      token,
      expiresAt: row.expires_at,
      leaseId,
      documentId: edlDoc.id,
      publicUrl,
      sentTo: toEmail,
      tenantId,
      role: tenant.role || null,
      forceUsed: !!force,
      overrideUsed: !!override,
    };
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

    if (!contractDoc) {
      const generated = await this.docs.generateContractPdf(leaseId);
      contractDoc = generated?.document ?? generated;
    }

    const contractDocId = String(contractDoc?.id || '').trim();
    if (!contractDocId) {
      // eslint-disable-next-line no-console
      console.error('[sendTenantSignLinks] Missing contractDoc.id', { leaseId, contractDoc });
      throw new BadRequestException('Contract document id missing');
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

private async findActiveGuarantorSignLinkByGuarantee(guaranteeId: string) {
  const q = await this.pool.query(
    `
    SELECT id, expires_at, created_at
    FROM public_links
    WHERE guarantee_id = $1
      AND purpose = 'GUARANT_SIGN_ACT'
      AND signer_role = 'GARANT'
      AND consumed_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [guaranteeId],
  );
  return q.rowCount ? q.rows[0] : null;
}

private async deleteActiveGuarantorSignLinksByGuarantee(guaranteeId: string) {
  await this.pool.query(
    `
    DELETE FROM public_links
    WHERE guarantee_id = $1
      AND purpose = 'GUARANT_SIGN_ACT'
      AND signer_role = 'GARANT'
      AND consumed_at IS NULL
      AND expires_at > NOW()
    `,
    [guaranteeId],
  );
}

private async findActiveGuaranteeLandlordSignLinkByGuarantee(guaranteeId: string) {
  const q = await this.pool.query(
    `
    SELECT id, expires_at, created_at
    FROM public_links
    WHERE guarantee_id = $1
      AND purpose = 'LANDLORD_SIGN_GUARANTEE_ACT'
      AND signer_role = 'BAILLEUR'
      AND consumed_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [guaranteeId],
  );
  return q.rowCount ? q.rows[0] : null;
}

private async deleteActiveGuaranteeLandlordSignLinksByGuarantee(guaranteeId: string) {
  await this.pool.query(
    `
    DELETE FROM public_links
    WHERE guarantee_id = $1
      AND purpose = 'LANDLORD_SIGN_GUARANTEE_ACT'
      AND signer_role = 'BAILLEUR'
      AND consumed_at IS NULL
      AND expires_at > NOW()
    `,
    [guaranteeId],
  );
}

async sendGuarantorSignLinkByGuarantee(
  guaranteeId: string,
  force = false,
  mode: 'SIGN' | 'SHARE_SIGNED' = 'SIGN',
  channel: 'email' | 'none' = 'email',
) {
  const gid = String(guaranteeId || '').trim();
  if (!gid) throw new BadRequestException('Missing guaranteeId');
  if (!this.isUuid(gid)) throw new BadRequestException('Invalid guaranteeId (uuid expected)');

  // 1) Charger la garantie + vérifier CAUTION
  const gQ = await this.pool.query(
    `
    SELECT *
    FROM lease_guarantees
    WHERE id = $1
    LIMIT 1
    `,
    [gid],
  );
  if (!gQ.rowCount) throw new BadRequestException('Unknown guaranteeId');

  const g = gQ.rows[0];

  if (String(g.type).toUpperCase() !== 'CAUTION') {
    throw new BadRequestException('Guarantee must be type CAUTION');
  }

  const leaseId = String(g.lease_id || '').trim();
  if (!leaseId) throw new BadRequestException('Guarantee has no lease_id');

  // 2) Infos garant depuis la garantie (pas leases)
  const gName = String(g.guarantor_full_name || '').trim();
  const gEmailRaw = String(g.guarantor_email || '').trim();

  const gEmail = gEmailRaw; 

  if (!gName) throw new BadRequestException('Guarantor name missing on guarantee');
  if (!gEmail) throw new BadRequestException('Guarantor email missing on guarantee');

  // 3) Guard: déjà signé ?
  // -> si mode=SIGN : on garde le comportement actuel (already_signed)
  // -> si mode=SHARE_SIGNED : on envoie le PDF signé en PJ
  if (g.signed_final_document_id) {
    if (mode === 'SIGN') {
      return {
        ok: true,
        forceUsed: !!force,
        sent: false,
        reason: 'already_signed',
        email: gEmail,
        guaranteeId: gid,
      };
    }

    // SHARE_SIGNED
    const signedFinalDocumentId = String(g.signed_final_document_id || '').trim();
    if (!signedFinalDocumentId) {
      return { ok: false, reason: 'not_signed_yet' };
    }

    if (channel === 'none') {
      return { ok: true, mode: 'SHARE_SIGNED', signedFinalDocumentId };
    }

    // 1) récupérer le fichier via DocumentsService
    const { absPath, filename } = await this.docs.getDocumentFile(signedFinalDocumentId);

    // 2) lire le fichier
    const buffer = await fs.readFile(absPath);

    // 3) envoyer email au garant
    const subject = 'Acte de caution signé';
    const html =
      `<p>Bonjour,</p>` +
      `<p>Veuillez trouver en pièce jointe l’acte de caution signé.</p>`;

    await this.mailer.sendMail(gEmail, subject, html, [
      {
        filename: filename ?? 'acte_caution_SIGNE.pdf',
        content: buffer,
        contentType: 'application/pdf',
      },
    ]);

    return { ok: true, mode: 'SHARE_SIGNED', sentTo: gEmail };
  }

  // 4) Guard: lien actif existant (scopé guarantee_id)
  const active = await this.findActiveGuarantorSignLinkByGuarantee(gid);
  if (active && !force) {
    return {
      ok: true,
      forceUsed: !!force,
      sent: false,
      reason: 'active_link_exists',
      email: gEmail,
      guaranteeId: gid,
      activeExpiresAt: active.expires_at,
    };
  }

  if (force) {
    await this.deleteActiveGuarantorSignLinksByGuarantee(gid);
  }

  // 5) Récupérer ou générer l’acte (document) rattaché à la garantie
  //    - si guarantor_act_document_id existe => on le prend
  //    - sinon => on le génère (via DocumentsService) puis on stocke sur lease_guarantees
  let actDoc: any = null;

  const actDocId = String(g.guarantor_act_document_id || '').trim();
  if (actDocId) {
    const dQ = await this.pool.query(`SELECT * FROM documents WHERE id=$1 LIMIT 1`, [actDocId]);
    if (dQ.rowCount) actDoc = dQ.rows[0];
  }

  if (!actDoc) {
    // ✅ Génère l'acte pour CE garant (scopé par guaranteeId) puis rattache sur lease_guarantees
    const gen = await this.docs.generateGuarantorActPdf(leaseId, { guaranteeId: gid });
    actDoc = gen?.document;
    if (!actDoc?.id) {
      throw new BadRequestException('Failed to generate guarantor act document');
    }

    await this.pool.query(
      `UPDATE lease_guarantees SET guarantor_act_document_id=$2 WHERE id=$1`,
      [gid, actDoc.id],
    );
  }

  // ✅ Guard already_signed (source de vérité: signatures)
  // 1) si la garantie est déjà finalisée
  if (g.signed_final_document_id) {
    return {
      ok: true,
      forceUsed: !!force,
      sent: false,
      reason: 'already_signed',
      email: gEmail,
      guaranteeId: gid,
      documentId: actDoc.id,
    };
  }

  // 2) sinon: si le GARANT a déjà signé l'acte (même si pas finalisé)
  const alreadySigned = await this.hasGuarantorAlreadySigned(actDoc.id);
  if (alreadySigned) {
    return {
      ok: true,
      forceUsed: !!force,
      sent: false,
      reason: 'already_signed',
      email: gEmail,
      guaranteeId: gid,
      documentId: actDoc.id,
    };
}

  // 6) Créer le lien public (scopé garantie)
  const { token, row } = await this.createPublicLink({
    leaseId,
    documentId: actDoc.id,
    purpose: 'GUARANT_SIGN_ACT',
    expiresInHours: 48,
    signerRole: 'GARANT',
    signerTenantId: null,
    signerName: gName,
    guaranteeId: gid,
  });

  const url = `https://app.rentalos.fr/public/sign/${token}`;
  const expiresPretty = new Date(row.expires_at).toLocaleString('fr-FR');

  // 7) Email
  const subject = `Signature de l'acte de caution — ${actDoc.filename || ''}`;
  const html = `
    <p>Bonjour ${gName},</p>
    <p>Merci de signer l’acte de caution.</p>
    <p><b>Lien de signature :</b><br/>
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
    guaranteeId: gid,
    documentId: actDoc.id,
    publicUrl: url,
  };
}

async createGuaranteeLandlordSignLinkAndEmail(
  guaranteeId: string,
  ttlHours = 72,
  emailOverride?: string | null,
  force = false,
) {
  const gid = String(guaranteeId || '').trim();
  if (!gid) throw new BadRequestException('Missing guaranteeId');
  if (!this.isUuid(gid)) throw new BadRequestException('Invalid guaranteeId (uuid expected)');

  const gQ = await this.pool.query(
    `
    SELECT *
    FROM lease_guarantees
    WHERE id = $1
    LIMIT 1
    `,
    [gid],
  );
  if (!gQ.rowCount) throw new BadRequestException('Unknown guaranteeId');

  const g = gQ.rows[0];

  if (String(g.type || '').toUpperCase() !== 'CAUTION') {
    throw new BadRequestException('Guarantee must be type CAUTION');
  }

  const leaseId = String(g.lease_id || '').trim();
  if (!leaseId) throw new BadRequestException('Guarantee has no lease_id');

  let actDoc: any = null;
  const actDocId = String(g.guarantor_act_document_id || '').trim();

  if (actDocId) {
    const dQ = await this.pool.query(`SELECT * FROM documents WHERE id=$1 LIMIT 1`, [actDocId]);
    if (dQ.rowCount) actDoc = dQ.rows[0];
  }

  if (!actDoc) {
    const gen = await this.docs.generateGuarantorActPdf(leaseId, { guaranteeId: gid });
    actDoc = gen?.document;
    if (!actDoc?.id) {
      throw new BadRequestException('Failed to generate guarantor act document');
    }

    await this.pool.query(
      `UPDATE lease_guarantees SET guarantor_act_document_id=$2 WHERE id=$1`,
      [gid, actDoc.id],
    );
  }

  if (g.signed_final_document_id) {
    return {
      ok: true,
      forceUsed: !!force,
      sent: false,
      reason: 'already_signed',
      guaranteeId: gid,
      documentId: actDoc.id,
    };
  }

  const alreadySigned = await this.hasRoleAlreadySigned(actDoc.id, 'BAILLEUR');
  if (alreadySigned && !force) {
    return {
      ok: true,
      forceUsed: !!force,
      sent: false,
      reason: 'already_signed',
      guaranteeId: gid,
      documentId: actDoc.id,
    };
  }

  const active = await this.findActiveGuaranteeLandlordSignLinkByGuarantee(gid);
  if (active && !force) {
    return {
      ok: true,
      forceUsed: !!force,
      sent: false,
      reason: 'active_link_exists',
      guaranteeId: gid,
      documentId: actDoc.id,
      activeExpiresAt: active.expires_at,
    };
  }

  if (force) {
    await this.deleteActiveGuaranteeLandlordSignLinksByGuarantee(gid);
  }

  const { landlordName, landlordEmail } = await this.resolveLandlordContactByLease(leaseId);

  const override =
    emailOverride && String(emailOverride).includes('@')
      ? String(emailOverride).trim()
      : '';

  const toEmail = override || landlordEmail;
  if (!toEmail) {
    throw new BadRequestException('Missing landlord email on project (or use emailOverride)');
  }

  const signerName = landlordName || 'Bailleur';

  const { token, row } = await this.createPublicLink({
    leaseId,
    documentId: actDoc.id,
    purpose: 'LANDLORD_SIGN_GUARANTEE_ACT',
    expiresInHours: ttlHours,
    signerRole: 'BAILLEUR',
    signerTenantId: null,
    signerName,
    guaranteeId: gid,
  });

  const publicUrl = `https://app.rentalos.fr/public/sign/${token}`;

  await this.mailer.sendMail(
    toEmail,
    `Signature bailleur — Acte de caution`,
    `
      <p>Bonjour,</p>
      <p>Merci de signer l'acte de caution.</p>
      <p><a href="${publicUrl}">${publicUrl}</a></p>
      <p>Ce lien expire le : <b>${String(row.expires_at).slice(0, 19)}</b></p>
    `,
  );

  return {
    ok: true,
    token,
    expiresAt: row.expires_at,
    leaseId,
    guaranteeId: gid,
    documentId: actDoc.id,
    publicUrl,
    sentTo: toEmail,
    overrideUsed: !!override,
    forceUsed: !!force,
  };
}

    async resolveToken(
      token: string,
      opts?: { consume?: boolean; allowConsumedWithinGrace?: boolean },
    ): Promise<any> {
    if (!token) throw new UnauthorizedException('Missing token');

    const tokenHash = this.sha256(token);

    const q = await this.pool.query(
        `SELECT
                pl.*,
                d.filename,
                d.storage_path,
                l.start_date,
                l.end_date_theoretical,
                l.rent_cents,
                l.charges_cents,
                l.lease_terms,
                u.code as unit_code,
                t.full_name as tenant_name
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
    // mais on ne marque plus consumed_at ici.
    if (consume) {
      await this.touchUsage(row.id);
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

  async markConsumed(id: string) {
    await this.pool.query(
      `UPDATE public_links SET consumed_at = NOW() WHERE id=$1 AND consumed_at IS NULL`,
      [id],
    );
  }

  async invalidateLink(id: string) {
    await this.pool.query(`DELETE FROM public_links WHERE id=$1`, [id]);
  }

  async getPublicInfo(token: string) {
    const row = await this.resolveToken(token, { consume: false });

    const leaseTerms =
      typeof row.lease_terms === 'string'
        ? JSON.parse(row.lease_terms || '{}')
        : row.lease_terms || {};

    const durationMonths = Number(leaseTerms?.durationMonths || 12);
    const rentCents = Number(row.rent_cents || 0);
    const chargesCents = Number(row.charges_cents || 0);
    const guaranteeCapCents = Math.max(0, durationMonths * (rentCents + chargesCents));

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
      rentCents,
      chargesCents,
      durationMonths,
      guaranteeCapCents,

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
    const allowed = new Set([
      'TENANT_SIGN_CONTRACT',
      'LANDLORD_SIGN_CONTRACT',
      'GUARANT_SIGN_ACT',
      'LANDLORD_SIGN_GUARANTEE_ACT',
      'TENANT_SIGN_EDL_ENTRY',
      'LANDLORD_SIGN_EDL_ENTRY',
      'TENANT_SIGN_INVENTORY_ENTRY',
      'LANDLORD_SIGN_INVENTORY_ENTRY',
      'TENANT_SIGN_EDL_EXIT',
      'LANDLORD_SIGN_EDL_EXIT',
      'TENANT_SIGN_INVENTORY_EXIT',
      'LANDLORD_SIGN_INVENTORY_EXIT',
    ]);
    if (!allowed.has(String(row.purpose || ''))) {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const absPath = path.join(this.storageBase, row.storage_path);
    return { absPath, filename: row.filename };
  }
  
  async publicSign(token: string, body: any, req: any) {
    const row = await this.resolveToken(token, { consume: false });

    const allowed = new Set([
      'TENANT_SIGN_CONTRACT',
      'LANDLORD_SIGN_CONTRACT',
      'GUARANT_SIGN_ACT',
      'LANDLORD_SIGN_GUARANTEE_ACT',
      'TENANT_SIGN_EDL_ENTRY',
      'LANDLORD_SIGN_EDL_ENTRY',
      'TENANT_SIGN_INVENTORY_ENTRY',
      'LANDLORD_SIGN_INVENTORY_ENTRY',
      'TENANT_SIGN_EDL_EXIT',
      'LANDLORD_SIGN_EDL_EXIT',
      'TENANT_SIGN_INVENTORY_EXIT',
      'LANDLORD_SIGN_INVENTORY_EXIT',
    ]);
    if (!allowed.has(String(row.purpose || ''))) {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const signatureDataUrl = body?.signatureDataUrl;
    if (!signatureDataUrl) {
      throw new BadRequestException('Missing signatureDataUrl');
    }

    const signerRole = String(row.signer_role || '').toUpperCase();
    if (!signerRole) {
      throw new UnauthorizedException('Missing signer role');
    }

    const signerTenantId = row.signer_tenant_id ?? null;

    let signerName =
      String(row.signer_name || '').trim() ||
      (signerRole === 'LOCATAIRE' ? row.tenant_name || 'Signataire' : 'Signataire');

    if (signerRole === 'BAILLEUR' && !String(row.signer_name || '').trim()) {
      const landlord = await this.resolveLandlordContactByLease(String(row.lease_id || '').trim());
      signerName = landlord.landlordName || 'Bailleur';
    }

    const result = await this.docs.signDocumentMulti(
      row.document_id,
      {
        signerName,
        signerRole,
        signatureDataUrl,
        signerTenantId,
        guarantorMention: body?.guarantorMention ?? null,
        guarantorMentionRequired: body?.guarantorMentionRequired ?? null,
      },
      req,
    );

    await this.touchUsage(row.id);
    await this.markConsumed(row.id);

    const until = this.downloadAvailableUntil(new Date());
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
