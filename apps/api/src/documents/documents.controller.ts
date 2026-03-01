import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res, UseGuards, Req, DefaultValuePipe, ParseBoolPipe } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { DocumentsService } from './documents.service';
import type { Response } from 'express';

@Controller('documents')
@UseGuards(JwtGuard)
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  private replyCreated(res: Response, result: any) {
    // ancien format: retourne direct un document
    if (result && result.id) {
      res.status(201);
      return result;
    }

    // nouveau format: { created: boolean, document: ... }
    const created = !!result?.created;
    res.status(created ? 201 : 200);
    return result?.document ?? result;
  }

  @Get()
  list(@Query('leaseId') leaseId: string) {
    if (!leaseId) return [];
    return this.docs.listByLease(leaseId);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const { absPath, filename } = await this.docs.getDocumentFile(id);
    return res.download(absPath, filename);
  }

  @Post('contract')
  async generateContract(
    @Body() body: any,
    @Query('force', new DefaultValuePipe(false), ParseBoolPipe) force: boolean,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.docs.generateContractPdf(body.leaseId, { force });
    return this.replyCreated(res, result);
  }

  @Post('notice')
  async generateNotice(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.docs.generateNoticePdf(body.leaseId);
    return this.replyCreated(res, result);
  }

  @Post('edl')
  async generateEdl(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.docs.generateEdlPdf(body.leaseId);
    return this.replyCreated(res, result);
  }

  @Post('inventory')
  async generateInventory(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.docs.generateInventoryPdf(body.leaseId);
    return this.replyCreated(res, result);
  }

  // ✅ Pack: Contrat + Notice (RP) + EDL + Inventaire
  @Post('pack')
  async generatePack(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.docs.generatePackPdf(body.leaseId);
    return this.replyCreated(res, result);
  }

  // ✅ Pack final V2 (contrat signé final + annexes + audit)
  @Post('pack-final')
  async generatePackFinal(
    @Body() body: any,
    @Query('force', new DefaultValuePipe(false), ParseBoolPipe) force: boolean,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.docs.generatePackFinalV2(body.leaseId, { force });
    return this.replyCreated(res, result);
  }

  @Post('guarantor-act')
  async guarantorAct(@Body() body: any) {
    const leaseId = String(body?.leaseId || '').trim();
    const guaranteeId = body?.guaranteeId ? String(body.guaranteeId).trim() : '';
    const leaseTenantId = body?.leaseTenantId ? String(body.leaseTenantId).trim() : '';
    const tenantId = body?.tenantId ? String(body.tenantId).trim() : '';

    if (!leaseId) throw new BadRequestException('Missing leaseId');

    // Si la UI a déjà choisi => on génère direct (priorité guaranteeId)
    if (guaranteeId || leaseTenantId || tenantId) {
      return this.docs.generateGuarantorActPdf(leaseId, {
        guaranteeId: guaranteeId || undefined,
        leaseTenantId: leaseTenantId || undefined,
        tenantId: tenantId || undefined,
      });
    }

    // Sinon: auto (0 / 1 / many)
    const candidates = await this.docs.getGuarantorActCandidates(leaseId);

    if (candidates.length === 0) {
      throw new BadRequestException('No selected CAUTION guarantee on this lease');
    }
    if (candidates.length === 1) {
      return this.docs.generateGuarantorActPdf(leaseId, {
        guaranteeId: String(candidates[0].guaranteeId),
      });
    }

    throw new BadRequestException({
      message: 'Multiple guarantor guarantees found on this lease. Provide guaranteeId (preferred) or leaseTenantId or tenantId.',
      candidates,
    } as any);
  }

  @Get('guarantor-act/candidates')
  async guarantorActCandidates(@Query('leaseId') leaseId: string) {
    return this.docs.getGuarantorActCandidates(String(leaseId || '').trim());
}

  @Post(':id/sign')
  sign(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.docs.signDocumentMulti(id, body, req);
  }
}
