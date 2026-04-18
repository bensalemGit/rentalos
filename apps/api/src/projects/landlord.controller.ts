import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { LandlordService } from './landlord.service';
import { UpsertLandlordDto } from './landlord.dto';

@Controller('projects')
@UseGuards(JwtGuard)
export class LandlordController {
  constructor(private readonly landlordService: LandlordService) {}

  @Get(':projectId/landlord')
  async get(@Param('projectId') projectId: string) {
    return this.landlordService.getByProject(projectId);
  }

  @Get(':projectId/landlord/readiness')
  getReadiness(@Param('projectId') projectId: string) {
    return this.landlordService.getReadiness(projectId);
  }

  @Put(':projectId/landlord')
  async upsert(@Param('projectId') projectId: string, @Body() dto: UpsertLandlordDto) {
    return this.landlordService.upsertForProject(projectId, dto);
  }
}