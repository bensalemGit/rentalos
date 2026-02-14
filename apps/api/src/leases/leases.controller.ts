import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { LeasesService } from './leases.service';
import { JwtGuard } from '../auth/jwt.guard';
import { CreateLeaseDto } from './dto/create-lease.dto';


@Controller('leases')
@UseGuards(JwtGuard)
export class LeasesController {
  constructor(private readonly leases: LeasesService) {}

  @Post()
  create(@Body() body: CreateLeaseDto) {
    return this.leases.createWithInit(body);
  }

  @Get()
  list() {
    return this.leases.list();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.leases.getDetails(id);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.leases.activateLease(id);
  }

  @Post(':id/notice')
  notice(@Param('id') id: string) {
    return this.leases.setNotice(id);
  }

  @Post(':id/cancel-notice')
  cancelNotice(@Param('id') id: string) {
    return this.leases.cancelNotice(id);
  }

  @Post(':id/close')
  close(@Param('id') id: string) {
    return this.leases.closeLease(id);
  }

  @Post(':id/tenants')
  addTenant(@Param('id') id: string, @Body() body: any) {
    return this.leases.addCoTenant(id, body);
  }

  @Delete(':id/tenants/:tenantId')
  removeTenant(@Param('id') id: string, @Param('tenantId') tenantId: string) {
    return this.leases.removeCoTenant(id, tenantId);
  }

  @Post(':id/amounts')
  addAmounts(@Param('id') id: string, @Body() body: any) {
    return this.leases.addAmounts(id, body);
  }

  // ✅ NEW: update designation + keys + IRL reference
  @Patch(':id/designation')
  updateDesignation(@Param('id') id: string, @Body() body: any) {
    return this.leases.updateDesignationAndIrl(id, body);
  }
}
