import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { LandlordService } from './landlord.service';
import { UpsertLandlordDto } from './landlord.dto';

@Controller('projects')
export class LandlordController {
  constructor(private readonly landlordService: LandlordService) {}

  @Get(':projectId/landlord')
  async get(@Param('projectId') projectId: string) {
    return this.landlordService.getByProject(projectId);
  }

  @Put(':projectId/landlord')
  async upsert(@Param('projectId') projectId: string, @Body() dto: UpsertLandlordDto) {
    return this.landlordService.upsertForProject(projectId, dto);
  }
}