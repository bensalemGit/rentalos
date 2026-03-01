import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { GuaranteesService } from './guarantees.service';

@Controller()
@UseGuards(JwtGuard)
export class GuaranteesController {
  constructor(private readonly guarantees: GuaranteesService) {}

  // GET /guarantees?leaseId=...
  @Get('guarantees')
  list(@Query('leaseId') leaseId: string) {
    return this.guarantees.listByLease(leaseId);
  }

  // GET /guarantees/:id
  @Get('guarantees/:id')
  get(@Param('id') id: string) {
    return this.guarantees.getOne(id);
  }

  // POST /guarantees
  @Post('guarantees')
  create(@Body() body: any) {
    return this.guarantees.create(body);
  }

  // PATCH /guarantees/:id
  @Patch('guarantees/:id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.guarantees.update(id, body);
  }

  // POST /guarantees/:id/select
  @Post('guarantees/:id/select')
  select(@Param('id') id: string) {
    return this.guarantees.select(id);
  }

  // DELETE /guarantees/:id
  @Delete('guarantees/:id')
  remove(@Param('id') id: string) {
    return this.guarantees.remove(id);
  }
}