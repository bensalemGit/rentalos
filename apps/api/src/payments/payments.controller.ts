import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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

  @Get('status')
  status(
    @Query('leaseId') leaseId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.payments.getStatus(leaseId, Number(year), Number(month));
  }

  @Get()
  list(@Query('leaseId') leaseId: string) {
    return this.payments.list(leaseId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.payments.remove(id);
  }
}
