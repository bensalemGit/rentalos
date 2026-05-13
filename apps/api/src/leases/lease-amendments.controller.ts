import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { LeaseAmendmentsService } from './lease-amendments.service';

@Controller('leases/:leaseId/amendments')
@UseGuards(JwtGuard)
export class LeaseAmendmentsController {
  constructor(private readonly service: LeaseAmendmentsService) {}

  @Get()
  list(@Param('leaseId') leaseId: string) {
    return this.service.list(leaseId);
  }

  @Get(':amendmentId')
  get(
    @Param('leaseId') leaseId: string,
    @Param('amendmentId') amendmentId: string,
  ) {
    return this.service.get(leaseId, amendmentId);
  }

  @Post()
  create(@Param('leaseId') leaseId: string, @Body() body: any) {
    return this.service.create(leaseId, body);
  }

  @Post(':amendmentId/generate')
  generate(
    @Param('leaseId') leaseId: string,
    @Param('amendmentId') amendmentId: string,
    @Body() body: any,
  ) {
    return this.service.generate(leaseId, amendmentId, { force: body?.force === true });
  }
}