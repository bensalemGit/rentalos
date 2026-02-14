import { Body, Controller, Get, Param, Post, Query, Res, UseGuards, Req } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { DocumentsService } from './documents.service';
import type { Response } from 'express';

@Controller('documents')
@UseGuards(JwtGuard)
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

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
  generateContract(@Body() body: any) {
    return this.docs.generateContractPdf(body.leaseId);
  }

  @Post('notice')
  generateNotice(@Body() body: any) {
    return this.docs.generateNoticePdf(body.leaseId);
  }

  @Post('edl')
  generateEdl(@Body() body: any) {
    return this.docs.generateEdlPdf(body.leaseId);
  }

  @Post('inventory')
  generateInventory(@Body() body: any) {
    return this.docs.generateInventoryPdf(body.leaseId);
  }

  // ✅ Pack: Contrat + Notice (RP) + EDL + Inventaire
  @Post('pack')
  generatePack(@Body() body: any) {
    return this.docs.generatePackPdf(body.leaseId);
  }

  @Post(':id/sign')
  sign(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.docs.signDocumentMulti(id, body, req);
  }
}
