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
  sendTenantLinks(@Body() body: any) {
    const ttlHours = body?.ttlHours ?? 72;
    const emailOverride = body?.emailOverride ?? null;
    const force = body?.force ?? false;
    return this.pub.sendTenantSignLinks(body.leaseId, ttlHours, emailOverride, !!force);
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
  sign(@Query('token') tokenQ: string, @Body() body: any, @Req() req: any) {
    const token = body?.token || tokenQ; // ✅ accepte body.token (nouveau) ou query token (compat)
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
  const force = !!body?.force;

  return this.pub.createLandlordSignLinkAndEmail(
    body.leaseId,
    ttlHours,
    emailOverride,
    force,
  );
}

@Post('public-links/edl-entry/tenant/send')
@UseGuards(JwtGuard)
sendEdlEntryTenantLinks(@Body() body: any) {
  const ttlHours = body?.ttlHours ?? 72;
  const emailOverride = body?.emailOverride ?? null;
  const force = !!body?.force;

  return this.pub.sendEdlEntryTenantLinks(
    body.leaseId,
    ttlHours,
    emailOverride,
    force,
  );
}

@Post('public-links/inventory-entry/tenant/send')
@UseGuards(JwtGuard)
sendInventoryEntryTenantLinks(@Body() body: any) {
  const ttlHours = body?.ttlHours ?? 72;
  const emailOverride = body?.emailOverride ?? null;
  const force = !!body?.force;

  return this.pub.sendInventoryEntryTenantLinks(
    body.leaseId,
    ttlHours,
    emailOverride,
    force,
  );
}

@Post('public-links/edl-entry/landlord/send')
@UseGuards(JwtGuard)
sendEdlEntryLandlordLink(@Body() body: any) {
  const ttlHours = body?.ttlHours ?? 72;
  const emailOverride = body?.emailOverride ?? null;
  const force = !!body?.force;

  return this.pub.createEdlEntryLandlordLinkAndEmail(
    body.leaseId,
    ttlHours,
    emailOverride,
    force,
  );
}

@Post('public-links/guarantor-sign/send')
@UseGuards(JwtGuard)
sendGuarantorLink(@Body() body: any) {
  const ttlHours = body?.ttlHours ?? 72;
  const emailOverride = body?.emailOverride ?? null;
  const force = !!body?.force;
  return this.pub.sendGuarantorSignLink(body.leaseId, ttlHours, emailOverride, force);
}

@Post('public-links/guarantor-sign/send-by-guarantee')
@UseGuards(JwtGuard)
sendGuarantorByGuarantee(
  @Body()
  body: {
    guaranteeId: string;
    force?: boolean;
    mode?: 'SIGN' | 'SHARE_SIGNED';
    channel?: 'email' | 'none';
  },
) {
  return this.pub.sendGuarantorSignLinkByGuarantee(
    body.guaranteeId,
    body.force ?? false,
    body.mode ?? 'SIGN',
    body.channel ?? 'email',
  );
}

@Post('public-links/final-pdf')
@UseGuards(JwtGuard)
createFinalPdfLink(@Body() body: any) {
  const ttlHours = body?.ttlHours ?? 72;
  return this.pub.createFinalPdfDownloadLink(body.leaseId, ttlHours);
}
@Get('public/download-final')
async downloadFinal(@Query('token') token: string, @Res() res: Response) {
  const { absPath, filename } = await this.pub.downloadFinalPdf(token);
  return res.download(absPath, filename);
}
  @Post('public-links/final-pack')
  @UseGuards(JwtGuard)
  createFinalPackLink(@Body() body: any) {
    const ttlHours = body?.ttlHours ?? 72;
    return this.pub.createFinalPackDownloadLink(body.leaseId, ttlHours);
  }

  @Get('public/download-pack')
  async downloadPack(@Query('token') token: string, @Res() res: Response) {
    const { absPath, filename } = await this.pub.downloadFinalPack(token);
    return res.download(absPath, filename);
  }
}
