import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { SignatureStatusService } from './signature-status.service';

@Controller('signature-status')
@UseGuards(JwtGuard)
export class SignatureStatusController {
  constructor(private readonly svc: SignatureStatusService) {}

  @Get()
  get(@Query('leaseId') leaseId: string) {
    return this.svc.getByLease(leaseId);
  }
}