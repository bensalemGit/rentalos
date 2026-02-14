import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { ReceiptsService } from './receipts.service';

@Controller('receipts')
@UseGuards(JwtGuard)
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  // Generate (or reuse) receipt PDF for month
  @Post('generate')
  generate(@Body() body: any) {
    return this.receipts.generate(body);
  }

  // Send receipt email (generates if needed)
  @Post('send')
  send(@Body() body: any) {
    return this.receipts.send(body);
  }
}
