import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { SignatureWorkflowService } from './signature-workflow.service';

@Controller('signature-workflow')
@UseGuards(JwtGuard)
export class SignatureWorkflowController {
  constructor(private readonly svc: SignatureWorkflowService) {}

  @Get()
  get(@Query('leaseId') leaseId: string) {
    return this.svc.getByLease(leaseId);
  }
}