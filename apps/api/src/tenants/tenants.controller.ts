import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@UseGuards(JwtGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post()
  create(@Body() body: any) {
    return this.tenants.create(body);
  }

  @Get()
  list() {
    return this.tenants.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.tenants.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.tenants.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tenants.remove(id);
  }
}
