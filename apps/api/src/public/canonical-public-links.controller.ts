import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { CanonicalPublicLinksService } from './canonical-public-links.service';
import { CreateCanonicalPublicLinkDto } from './canonical-public-links.dto';

@Controller('canonical-public-links')
@UseGuards(JwtGuard)
export class CanonicalPublicLinksController {
  constructor(private readonly svc: CanonicalPublicLinksService) {}

  @Post()
  create(@Body() body: CreateCanonicalPublicLinkDto) {
    return this.svc.createLink(body);
  }
}