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

      if (!input.tenantId) {
        throw new BadRequestException('tenantId requis pour LEASE_CONTRACT / TENANT');
      }

      return this.publicService.createTenantContractLinkAndEmail(
        input.leaseId,
        input.tenantId,
        ttlHours,
        null,
        force,
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

    // GUARANTEE / LANDLORD
    if (
      input.documentType === 'GUARANTEE_ACT' &&
      input.signerRole === 'LANDLORD'
    ) {
      if (!input.guaranteeId) {
        throw new BadRequestException('guaranteeId requis pour GUARANTEE_ACT / LANDLORD');
      }

      return this.publicService.createGuaranteeLandlordSignLinkAndEmail(
        input.guaranteeId,
        ttlHours,
        null,
        force,
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

      if (!input.tenantId) {
        throw new BadRequestException('tenantId requis pour EDL_ENTRY / TENANT');
      }

      return this.publicService.createEdlEntryTenantLinkAndEmail(
        input.leaseId,
        input.tenantId,
        ttlHours,
        null,
        force,
      );
    }

    // EDL EXIT / TENANT
    if (
      input.documentType === 'EDL_EXIT' &&
      input.phase === 'EXIT' &&
      input.signerRole === 'TENANT'
    ) {
      if (!input.leaseId) {
        throw new BadRequestException('leaseId requis');
      }

      if (!input.tenantId) {
        throw new BadRequestException('tenantId requis pour EDL_EXIT / TENANT');
      }

      return this.publicService.createEdlExitTenantLinkAndEmail(
        input.leaseId,
        input.tenantId,
        ttlHours,
        null,
        force,
      );
    }

    // EDL EXIT / LANDLORD
    if (
      input.documentType === 'EDL_EXIT' &&
      input.phase === 'EXIT' &&
      input.signerRole === 'LANDLORD'
    ) {
      if (!input.leaseId) {
        throw new BadRequestException('leaseId requis');
      }

      return this.publicService.createEdlExitLandlordLinkAndEmail(
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
      return this.publicService.createEdlEntryLandlordLinkAndEmail(
        input.leaseId,
        ttlHours,
        null,
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

      if (!input.tenantId) {
        throw new BadRequestException('tenantId requis pour INVENTORY_ENTRY / TENANT');
      }

      return this.publicService.createInventoryEntryTenantLinkAndEmail(
        input.leaseId,
        input.tenantId,
        ttlHours,
        null,
        force,
      );
    }

    // INVENTORY ENTRY / LANDLORD
    if (
      input.documentType === 'INVENTORY_ENTRY' &&
      input.phase === 'ENTRY' &&
      input.signerRole === 'LANDLORD'
    ) {
      if (!input.leaseId) {
        throw new BadRequestException('leaseId requis');
      }

      return this.publicService.createInventoryEntryLandlordLinkAndEmail(
        input.leaseId,
        ttlHours,
        null,
        force,
      );
    }

        // INVENTORY EXIT / TENANT
    if (
      input.documentType === 'INVENTORY_EXIT' &&
      input.phase === 'EXIT' &&
      input.signerRole === 'TENANT'
    ) {
      if (!input.leaseId) {
        throw new BadRequestException('leaseId requis');
      }

      if (!input.tenantId) {
        throw new BadRequestException('tenantId requis pour INVENTORY_EXIT / TENANT');
      }

      return this.publicService.createInventoryExitTenantLinkAndEmail(
        input.leaseId,
        input.tenantId,
        ttlHours,
        null,
        force,
      );
    }

    // INVENTORY EXIT / LANDLORD
    if (
      input.documentType === 'INVENTORY_EXIT' &&
      input.phase === 'EXIT' &&
      input.signerRole === 'LANDLORD'
    ) {
      if (!input.leaseId) {
        throw new BadRequestException('leaseId requis');
      }

      return this.publicService.createInventoryExitLandlordLinkAndEmail(
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