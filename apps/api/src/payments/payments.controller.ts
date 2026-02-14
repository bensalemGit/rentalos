import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  create(@Body() body: any) {
    return this.payments.create(body);
  }

  @Get()
  list(@Query('leaseId') leaseId: string) {
    return this.payments.list(leaseId);
  }
}
