import { Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';

type TenantSigStatus = 'NOT_SENT' | 'SENT' | 'SIGNED';
type LandlordSigStatus = 'NOT_SENT' | 'SENT' | 'SIGNED';
type DocSigStatus = 'NOT_GENERATED' | 'DRAFT' | 'IN_PROGRESS' | 'SIGNED';
type GuaranteeSigStatus = 'NOT_SENT' | 'SENT' | 'IN_PROGRESS' | 'SIGNED';

type PublicLinkRow = {
  id: string;
  purpose: string;
  signer_role: string | null;
  signer_tenant_id: string | null;
  signer_name: string | null;
  guarantee_id: string | null;
  created_at: string;
  expires_at: string | null;
  consumed_at: string | null;
};

type SignatureRow = {
  signer_role: string;
  signer_tenant_id: string | null;
  signed_at: string | null;
};

type DocSignatureRow = SignatureRow & {
  document_id: string;
};

type LeaseTenantRow = {
  lease_tenant_id: string;
  tenant_id: string;
  role: string | null;
  full_name: string;
};

type GuaranteeRow = {
  guarantee_id: string;
  lease_tenant_id: string;
  guarantee_status: string | null;
  rank: number | null;
  guarantor_full_name: string | null;
  guarantor_email: string | null;
  guarantor_phone: string | null;
  guarantor_act_document_id: string | null;
  guarantee_signed_final_document_id: string | null;
  tenant_id: string;
  tenant_full_name: string;
};

@Injectable()
export class SignatureStatusService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  private nowIso() {
    return new Date().toISOString();
  }

  async getByLease(leaseId: string) {
    const cleanLeaseId = String(leaseId || '').trim();
    if (!cleanLeaseId) throw new BadRequestException('Missing leaseId');

    // 1) Contract doc (latest root)
    const contractQ = await this.pool.query(
      `
      SELECT *
      FROM documents
      WHERE lease_id=$1 AND type='CONTRAT' AND parent_document_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [cleanLeaseId],
    );
    const contractDoc = contractQ.rowCount ? contractQ.rows[0] : null;

    // 2) Tenants of lease
    const tenantsQ = await this.pool.query(
      `
      SELECT
        lt.id as lease_tenant_id,
        lt.tenant_id,
        lt.role,
        t.full_name
      FROM lease_tenants lt
      JOIN tenants t ON t.id = lt.tenant_id
      WHERE lt.lease_id=$1
      ORDER BY
        CASE WHEN lt.role='principal' THEN 0 ELSE 1 END,
        t.full_name ASC
      `,
      [cleanLeaseId],
    );
    const leaseTenants: LeaseTenantRow[] = (tenantsQ.rows || []) as LeaseTenantRow[];

    // 3) Contract signatures (if contract exists)
    const contractSigsQ = contractDoc
      ? await this.pool.query(
          `
          SELECT signer_role, signer_tenant_id, signed_at
          FROM signatures
          WHERE document_id=$1
          `,
          [contractDoc.id],
        )
      : { rows: [] as any[] };

    const contractSigs: SignatureRow[] = (contractSigsQ.rows || []) as SignatureRow[];

    const tenantSignedSet = new Set<string>(
      contractSigs
        .filter((s: SignatureRow) => s.signer_role === 'LOCATAIRE' && Boolean(s.signer_tenant_id))
        .map((s: SignatureRow) => String(s.signer_tenant_id)),
    );

    const landlordSigned = contractSigs.some((s: SignatureRow) => s.signer_role === 'BAILLEUR');

    // 4) Public links for this lease (tenant + landlord + guarant)
    const linksQ = await this.pool.query(
      `
      SELECT
        id, purpose, signer_role, signer_tenant_id, signer_name,
        guarantee_id,
        created_at, expires_at, consumed_at
      FROM public_links
      WHERE lease_id=$1
      ORDER BY created_at DESC
      `,
      [cleanLeaseId],
    );
    const links: PublicLinkRow[] = (linksQ.rows || []) as PublicLinkRow[];

    const latestTenantLinkByTenantId = new Map<string, PublicLinkRow>();
    const latestLandlordLink =
      links.find((l: PublicLinkRow) => l.purpose === 'LANDLORD_SIGN_CONTRACT') || null;

    for (const l of links) {
      if (l.purpose === 'TENANT_SIGN_CONTRACT' && l.signer_tenant_id) {
        const tid = String(l.signer_tenant_id);
        if (!latestTenantLinkByTenantId.has(tid)) latestTenantLinkByTenantId.set(tid, l);
      }
    }

    // 5) Guarantees (selected cautions only)
    const guaranteesQ = await this.pool.query(
      `
      SELECT
        g.id as guarantee_id,
        g.lease_tenant_id,
        g.status as guarantee_status,
        g.rank,
        g.guarantor_full_name,
        g.guarantor_email,
        g.guarantor_phone,
        g.guarantor_act_document_id,
        g.signed_final_document_id as guarantee_signed_final_document_id,
        lt.tenant_id,
        t.full_name as tenant_full_name
      FROM lease_guarantees g
      JOIN lease_tenants lt ON lt.id = g.lease_tenant_id
      JOIN tenants t ON t.id = lt.tenant_id
      WHERE g.lease_id=$1 AND g.type='CAUTION' AND g.selected=true
      ORDER BY g.rank NULLS LAST, g.created_at ASC
      `,
      [cleanLeaseId],
    );
    const guarantees: GuaranteeRow[] = (guaranteesQ.rows || []) as GuaranteeRow[];

    // 6) Read signatures for all guarantor acts (to detect IN_PROGRESS even without public link)
    const guarantActIds = guarantees
      .map((g: GuaranteeRow) => g.guarantor_act_document_id)
      .filter((id: string | null): id is string => Boolean(id))
      .map((id: string) => String(id));
    const guarantSigsByDocId = new Map<string, DocSignatureRow[]>();
    if (guarantActIds.length) {
      const sigsQ = await this.pool.query(
        `
        SELECT document_id, signer_role, signer_tenant_id, signed_at
        FROM signatures
        WHERE document_id = ANY($1::uuid[])
        `,
        [guarantActIds],
      );
      const rows: DocSignatureRow[] = (sigsQ.rows || []) as DocSignatureRow[];
      for (const s of sigsQ.rows || []) {
        const did = String(s.document_id);
        if (!guarantSigsByDocId.has(did)) guarantSigsByDocId.set(did, []);
        guarantSigsByDocId.get(did)!.push(s);
      }
    }

    // ---- Assemble response -------------------------------------------------

    const tenantsOut = leaseTenants.map((lt: LeaseTenantRow) => {
      const tenantId = String(lt.tenant_id || '');
      const signed = tenantSignedSet.has(tenantId);

      const latestLink = latestTenantLinkByTenantId.get(tenantId) || null;
      const sent = Boolean(latestLink && !latestLink.consumed_at);

      const signatureStatus: TenantSigStatus = signed ? 'SIGNED' : sent ? 'SENT' : 'NOT_SENT';

      return {
        leaseTenantId: String(lt.lease_tenant_id),
        tenantId,
        role: lt.role || '',
        fullName: lt.full_name || '',
        signatureStatus,
        lastLink: latestLink
          ? {
              createdAt: latestLink.created_at,
              expiresAt: latestLink.expires_at,
              consumedAt: latestLink.consumed_at,
            }
          : null,
      };
    });

    const landlordOut = (() => {
      const signed = landlordSigned;
      const sent = Boolean(latestLandlordLink && !latestLandlordLink.consumed_at);
      const signatureStatus: LandlordSigStatus = signed ? 'SIGNED' : sent ? 'SENT' : 'NOT_SENT';
      return {
        signatureStatus,
        lastLink: latestLandlordLink
          ? {
              createdAt: latestLandlordLink.created_at,
              expiresAt: latestLandlordLink.expires_at,
              consumedAt: latestLandlordLink.consumed_at,
            }
          : null,
      };
    })();

    const contractStatus: DocSigStatus = (() => {
      if (!contractDoc) return 'NOT_GENERATED';
      if (contractDoc.signed_final_document_id) return 'SIGNED';
      if (contractSigs.length === 0) return 'DRAFT';
      return 'IN_PROGRESS';
    })();

    // Guarantee status derive
    const latestGuarantLinkByGuaranteeId = new Map<string, PublicLinkRow>();
    for (const l of links) {
      if (l.purpose === 'GUARANT_SIGN_ACT' && l.guarantee_id) {
        const gid = String(l.guarantee_id);
        if (!latestGuarantLinkByGuaranteeId.has(gid)) latestGuarantLinkByGuaranteeId.set(gid, l);
      }
    }

    const guaranteesOut = guarantees.map((g: GuaranteeRow) => {
      const guaranteeId = String(g.guarantee_id);
      const actDocumentId = g.guarantor_act_document_id ? String(g.guarantor_act_document_id) : null;

      const signedFinalDocumentId =
        g.guarantee_signed_final_document_id ? String(g.guarantee_signed_final_document_id) : null;

      const latestLink = latestGuarantLinkByGuaranteeId.get(guaranteeId) || null;
      const sent = Boolean(latestLink && !latestLink.consumed_at);

      const sigs = actDocumentId ? guarantSigsByDocId.get(actDocumentId) || [] : [];
      const hasAnySig = sigs.length > 0;

      const hasGuarantSig = sigs.some((s) => s.signer_role === 'GARANT');
      const hasLandlordSig = sigs.some((s) => s.signer_role === 'BAILLEUR');

      const need = signedFinalDocumentId
        ? { guarantor: false, landlord: false }
        : { guarantor: !hasGuarantSig, landlord: !hasLandlordSig };

      const signatureStatus: GuaranteeSigStatus =
        signedFinalDocumentId ? 'SIGNED' : hasAnySig ? 'IN_PROGRESS' : sent ? 'SENT' : 'NOT_SENT';

      return {
        guaranteeId,
        leaseTenantId: String(g.lease_tenant_id),
        tenantId: String(g.tenant_id),
        tenantFullName: g.tenant_full_name || '',
        guarantorFullName: g.guarantor_full_name || '',
        guarantorEmail: g.guarantor_email || null,
        guarantorPhone: g.guarantor_phone || null,
        actDocumentId,
        signedFinalDocumentId,
        signatureStatus,
        need,
        lastLink: latestLink
          ? {
              createdAt: latestLink.created_at,
              expiresAt: latestLink.expires_at,
              consumedAt: latestLink.consumed_at,
            }
          : null,
        guaranteeStatus: g.guarantee_status || null,
      };
    });
    
    const contractNeed = {
      landlord: !landlordSigned,
      tenants: tenantsOut.filter((t) => t.signatureStatus !== 'SIGNED').map((t) => t.tenantId),
    };
    return {
      leaseId: cleanLeaseId,
      generatedAt: this.nowIso(),

      contract: {
        documentId: contractDoc?.id || null,
        filename: contractDoc?.filename || null,
        signedFinalDocumentId: contractDoc?.signed_final_document_id || null,
        status: contractStatus,
        need: contractDoc
          ? contractNeed
          : { landlord: true, tenants: tenantsOut.map((t) => t.tenantId) },
        landlord: landlordOut,
        tenants: tenantsOut,
      },

      guarantees: guaranteesOut,
    };
  }
}