import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PublicService } from './public.service';
import type { Response } from 'express';

@Controller()
export class PublicController {
  constructor(private readonly pub: PublicService) {}

  // --- Admin: create public link (requires auth) ---
  @Post('public-links/tenant-sign')
  @UseGuards(JwtGuard)
  createTenantLink(@Body() body: any) {
    const ttlHours = body?.ttlHours ?? 72;
    return this.pub.createTenantSignLink(body.leaseId, ttlHours);
  }

  // ✅ Admin: create link + send email (requires auth)
  // Now supports emailOverride in body
  @Post('public-links/tenant-sign/send')
  @UseGuards(JwtGuard)
  sendTenantLink(@Body() body: any) {
    const ttlHours = body?.ttlHours ?? 72;
    const emailOverride = body?.emailOverride ?? null;
    return this.pub.createTenantSignLinkAndEmail(body.leaseId, ttlHours, emailOverride);
  }

  // --- Public: get info about link (no auth) ---
  @Get('public/info')
  info(@Query('token') token: string) {
    return this.pub.getPublicInfo(token);
  }

  // --- Public: download contract PDF (no auth, token required) ---
  @Get('public/download')
  async download(@Query('token') token: string, @Res() res: Response) {
    const { absPath, filename } = await this.pub.downloadContract(token);
    return res.download(absPath, filename);
  }

  // --- Public: tenant signs (no auth, token required) ---
  @Post('public/sign')
  sign(@Query('token') token: string, @Body() body: any, @Req() req: any) {
    return this.pub.publicSign(token, body, req);
  }

  // --- Admin: create landlord public sign link (requires auth) ---
@Post('public-links/landlord-sign')
@UseGuards(JwtGuard)
createLandlordLink(@Body() body: any) {
  const ttlHours = body?.ttlHours ?? 72;
  return this.pub.createLandlordSignLink(body.leaseId, ttlHours);
}

// --- Admin: create landlord link + send email (requires auth) ---
@Post('public-links/landlord-sign/send')
@UseGuards(JwtGuard)
sendLandlordLink(@Body() body: any) {
  const ttlHours = body?.ttlHours ?? 72;
  const emailOverride = body?.emailOverride ?? null;
  return this.pub.createLandlordSignLinkAndEmail(
    body.leaseId,
    ttlHours,
    emailOverride,
  );
}
}
