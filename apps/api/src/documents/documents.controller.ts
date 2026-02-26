import { Body, Controller, Get, Param, Post, Query, Res, UseGuards, Req} from '@nestjs/common';
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
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.docs.generateContractPdf(body.leaseId);
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

  @Post('guarantor-act')
  async generateGuarantorAct(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.docs.generateGuarantorActPdf(body.leaseId);
    return this.replyCreated(res, result);
  }

  @Post(':id/sign')
  sign(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.docs.signDocumentMulti(id, body, req);
  }
}
