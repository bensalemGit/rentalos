import { BadRequestException, Injectable } from '@nestjs/common';
import { PublicService } from './public.service';
import { CreateCanonicalPublicLinkDto } from './canonical-public-links.dto';

@Injectable()
export class CanonicalPublicLinksService {
  constructor(private readonly publicService: PublicService) {}

  async createLink(input: CreateCanonicalPublicLinkDto) {
    const force = !!input.force;
    const ttlHours = input.ttlHours ?? 72;

    // CONTRAT / TENANT
    if (
      input.documentType === 'LEASE_CONTRACT' &&
      input.signerRole === 'TENANT'
    ) {
      if (!input.leaseId) {
        throw new BadRequestException('leaseId requis');
      }

      // NOTE
      // createTenantSignLink ne permet pas de cibler un tenant précis.
      // À ce stade, on retourne juste un lien de signature contrat "tenant".
      // L’unification fine multi-locataires viendra à l’étape suivante.
      return this.publicService.createTenantSignLink(
        input.leaseId,
        ttlHours,
        'TENANT_SIGN_CONTRACT',
      );
    }

    // CONTRAT / LANDLORD
        if (
      input.documentType === 'LEASE_CONTRACT' &&
      input.signerRole === 'LANDLORD'
    ) {
      console.log('[CANONICAL PUBLIC LINKS] LANDLORD CONTRACT -> createLandlordSignLinkAndEmail', {
        leaseId: input.leaseId,
        ttlHours,
        force,
      });

      return this.publicService.createLandlordSignLinkAndEmail(
        input.leaseId,
        ttlHours,
        null,
        force,
      );
    }

    // GUARANTEE / GUARANTOR
    if (
      input.documentType === 'GUARANTEE_ACT' &&
      input.signerRole === 'GUARANTOR'
    ) {
      if (!input.guaranteeId) {
        throw new BadRequestException('guaranteeId requis pour GUARANTEE_ACT / GUARANTOR');
      }

      return this.publicService.sendGuarantorSignLinkByGuarantee(
        input.guaranteeId,
        force,
        'SIGN',
        'none',
      );
    }

    // EDL ENTRY / TENANT
    if (
      input.documentType === 'EDL_ENTRY' &&
      input.phase === 'ENTRY' &&
      input.signerRole === 'TENANT'
    ) {
      if (!input.leaseId) {
        throw new BadRequestException('leaseId requis');
      }

      // NOTE
      // sendEdlEntryTenantLinks envoie/crée pour tous les locataires.
      // Pas encore ciblé tenant par tenant dans PublicService.
      return this.publicService.sendEdlEntryTenantLinks(
        input.leaseId,
        ttlHours,
        null,
        force,
      );
    }

    // EDL ENTRY / LANDLORD
    if (
      input.documentType === 'EDL_ENTRY' &&
      input.phase === 'ENTRY' &&
      input.signerRole === 'LANDLORD'
    ) {
      return this.publicService.createEdlEntryLandlordLink(
        input.leaseId,
        ttlHours,
        force,
      );
    }

    // INVENTORY ENTRY / TENANT
    if (
      input.documentType === 'INVENTORY_ENTRY' &&
      input.phase === 'ENTRY' &&
      input.signerRole === 'TENANT'
    ) {
      if (!input.leaseId) {
        throw new BadRequestException('leaseId requis');
      }

      // NOTE
      // sendInventoryEntryTenantLinks envoie/crée pour tous les locataires.
      return this.publicService.sendInventoryEntryTenantLinks(
        input.leaseId,
        ttlHours,
        null,
        force,
      );
    }

    throw new BadRequestException(
      `Combinaison non supportée pour le moment: ${input.documentType} / ${input.phase} / ${input.signerRole}`,
    );
  }
}