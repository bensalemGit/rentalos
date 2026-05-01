import { Controller, Get, Post, Delete, Body, Query, Param } from '@nestjs/common';
import { LeaseDepositService } from './lease-deposit.service';

@Controller('lease-deposit')
export class LeaseDepositController {
  constructor(private readonly service: LeaseDepositService) {}

  @Get()
  list(@Query('leaseId') leaseId: string) {
    return this.service.list(leaseId);
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Post('summary')
  generateSummary(@Body() body: any) {
    return this.service.generateSummary(body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}