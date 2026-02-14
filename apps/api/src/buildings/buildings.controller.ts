import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { BuildingsService } from './buildings.service';

@Controller('buildings')
@UseGuards(JwtGuard)
export class BuildingsController {
  constructor(private readonly svc: BuildingsService) {}

  @Get()
  list(@Query('projectId') projectId?: string) {
    return this.svc.list(projectId);
  }

  @Post()
  create(@Body() body: any) {
    return this.svc.create(body);
  }
}
