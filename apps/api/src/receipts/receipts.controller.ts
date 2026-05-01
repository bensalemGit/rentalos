import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { ReceiptsService } from './receipts.service';

@Controller('receipts')
@UseGuards(JwtGuard)
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @Get()
  list(@Query('leaseId') leaseId: string) {
    return this.receipts.list(leaseId);
  }

  @Post('generate')
  generate(@Body() body: any) {
    return this.receipts.generate(body);
  }

  @Post('send')
  send(@Body() body: any) {
    return this.receipts.send(body);
  }
}