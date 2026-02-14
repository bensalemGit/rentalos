import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { UnitsService } from './units.service';
import { UnitReferencesService } from '../unit-references/unit-references.service';

@Controller('units')
@UseGuards(JwtGuard)
export class UnitsController {
  constructor(
    private readonly units: UnitsService,
    private readonly unitRefs: UnitReferencesService,
  ) {}

  @Post()
  create(@Body() body: any) {
    return this.units.create(body);
  }

  @Get()
  list() {
    return this.units.list();
  }

  // ✅ update existing unit
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.units.update(id, body);
  }

  /**
   * ✅ Save the latest EDL + Inventory sessions of a lease as the Unit reference model.
   * POST /api/units/:unitId/reference/from-lease/:leaseId
   */
  @Post(':unitId/reference/from-lease/:leaseId')
  saveReferenceFromLease(
    @Param('unitId') unitId: string,
    @Param('leaseId') leaseId: string,
  ) {
    return this.units.saveReferenceFromLease(unitId, leaseId);
  }

  /**
   * ✅ Endpoint attendu par l'UI
   * GET /api/units/:unitId/references
   */
  @Get(':unitId/references')
  getUnitReferences(@Param('unitId') unitId: string) {
    // délègue au module unit-references
    return this.unitRefs.getUnitReferencesPreview(unitId);
  }
}
