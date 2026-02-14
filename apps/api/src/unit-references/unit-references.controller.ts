import { Controller, Get, Query } from '@nestjs/common';
import { UnitReferencesService } from './unit-references.service';

@Controller('unit-references')
export class UnitReferencesController {
  constructor(private readonly service: UnitReferencesService) {}

  @Get('preview')
  async preview(@Query('unitId') unitId: string) {
    return this.service.getUnitReferencesPreview(unitId);
  }
}
