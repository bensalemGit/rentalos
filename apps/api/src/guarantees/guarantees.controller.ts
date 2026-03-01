import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
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

  // GET /guarantees/by-lease-tenant?leaseTenantId=...
  @Get('guarantees/by-lease-tenant')
  listByLeaseTenant(@Query('leaseTenantId') leaseTenantId: string) {
    return this.guarantees.listByLeaseTenant(leaseTenantId);
  }

  // GET /guarantees/:id
  @Get('guarantees/:id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.guarantees.getOne(id);
  }

  // POST /guarantees
  @Post('guarantees')
  create(@Body() body: any) {
    return this.guarantees.create(body);
  }

  // PATCH /guarantees/:id
  @Patch('guarantees/:id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: any) {
    return this.guarantees.update(id, body);
  }

  // DELETE /guarantees/:id
  @Delete('guarantees/:id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.guarantees.remove(id);
  }

  // POST /guarantees/:id/select
  @Post('guarantees/:id/select')
  select(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.guarantees.select(id);
  }
}