import { BadRequestException, Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { UnitReferencesService } from './unit-references.service';

@Controller('units')
@UseGuards(JwtGuard)
export class UnitReferencesController {
  constructor(private readonly refs: UnitReferencesService) {}

  // GET /units/:unitId/references
  @Get(':unitId/references')
  async get(@Param('unitId') unitId: string) {
    if (!unitId) throw new BadRequestException('Missing unitId');
    return this.refs.getUnitReferences(unitId);
  }
}
