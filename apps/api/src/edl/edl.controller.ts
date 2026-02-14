import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtGuard } from '../auth/jwt.guard';
import { EdlService } from './edl.service';

@Controller('edl')
@UseGuards(JwtGuard)
export class EdlController {
  constructor(private readonly edl: EdlService) {}

  @Get('sessions')
  sessions(@Query('leaseId') leaseId?: string) {
    return this.edl.listSessions(leaseId);
  }

  @Post('sessions')
  createSession(
    @Query('leaseId') leaseIdQ?: string,
    @Query('status') statusQ?: string,
    @Body('leaseId') leaseIdB?: string,
    @Body('status') statusB?: string,
  ) {
    const leaseId = leaseIdQ || leaseIdB;
    const status = statusQ || statusB;

    if (!leaseId) throw new BadRequestException('Missing leaseId');
    return this.edl.createSession(leaseId, status || 'entry');
  }

  // GET /edl/reference?leaseId=...
  @Get('reference')
  async getReference(@Query('leaseId') leaseId?: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    return this.edl.getEdlReferenceForLease(leaseId);
  }

  @Get('items')
  items(@Query('edlSessionId') edlSessionId: string) {
    if (!edlSessionId) throw new BadRequestException('Missing edlSessionId');
    return this.edl.listItems(edlSessionId);
  }

  // POST /edl/items  { edlSessionId, section, label }
  @Post('items')
  addItem(@Body() body: any) {
    const edlSessionId = body?.edlSessionId || body?.edl_session_id;
    const section = body?.section;
    const label = body?.label;

    if (!edlSessionId) throw new BadRequestException('Missing edlSessionId');
    if (!label) throw new BadRequestException('Missing label');

    return this.edl.addItemToSession(
      String(edlSessionId),
      String(section || 'Divers'),
      String(label),
    );
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() body: any) {
    if (!id) throw new BadRequestException('Missing id');
    return this.edl.updateItem(id, body);
  }

  @Delete('items/:id')
  removeItem(@Param('id') id: string) {
    if (!id) throw new BadRequestException('Missing id');
    return this.edl.removeItemFromSession(id);
  }

  @Post('copy-entry-to-exit')
  copyEntryToExit(@Query('leaseId') leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    return this.edl.copyEntryToExit(leaseId);
  }

  // POST /edl/reference?leaseId=...&edlSessionId=...
  @Post('reference')
  async setReference(
    @Query('leaseId') leaseId?: string,
    @Query('edlSessionId') edlSessionId?: string,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    return this.edl.setEdlReferenceFromLease(leaseId, edlSessionId);
  }

  // POST /edl/apply-reference?leaseId=...&status=entry|exit
  @Post('apply-reference')
  async applyReference(
    @Query('leaseId') leaseId?: string,
    @Query('status') status?: string,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    return this.edl.applyEdlReferenceToLease(leaseId, status || 'entry');
  }

  @Get('photos')
  photos(@Query('edlItemId') edlItemId: string) {
    if (!edlItemId) throw new BadRequestException('Missing edlItemId');
    return this.edl.listPhotos(edlItemId);
  }

  @Post('photos')
  @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(@UploadedFile() file: any, @Body() body: any) {
    return this.edl.uploadPhoto(file, body);
  }

  @Get('photos/:id/download')
  async downloadPhoto(@Param('id') id: string, @Res() res: Response) {
    if (!id) throw new BadRequestException('Missing id');
    const f = await this.edl.getPhotoFile(id);
    return res.download(f.absPath, f.filename);
  }
}
