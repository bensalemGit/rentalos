import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Param,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtGuard } from '../auth/jwt.guard';

@Controller('inventory')
@UseGuards(JwtGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('sessions')
  async listSessions(@Query('leaseId') leaseId?: string, @Query('lease_id') lease_id?: string) {
    const id = leaseId || lease_id;
    return this.inventory.listSessions(id);
  }

  @Post('sessions')
  async createSession(
    @Query('leaseId') leaseIdQ?: string,
    @Query('lease_id') leaseIdQ2?: string,
    @Query('status') statusQ?: string,
    @Body('leaseId') leaseId?: string,
    @Body('lease_id') lease_id?: string,
    @Body('status') statusB?: string,
  ) {
    const id = leaseIdQ || leaseIdQ2 || leaseId || lease_id;
    if (!id) throw new BadRequestException('Missing leaseId');

    const normalized = String(statusQ || statusB || 'entry').trim().toLowerCase();
    const finalStatus = normalized === 'draft' ? 'entry' : normalized;

    return this.inventory.createSession(id, finalStatus);
  }

  // ✅ Consulter la référence logement (Inventaire)
  // GET /inventory/reference?leaseId=...
  @Get('reference')
  async getReference(@Query('leaseId') leaseId?: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    return this.inventory.getInventoryReferenceForLease(leaseId);
  }

  @Get('lines')
  async listLines(@Query('inventorySessionId') inventorySessionId?: string) {
    if (!inventorySessionId) throw new BadRequestException('Missing inventorySessionId');
    return this.inventory.listLines(inventorySessionId);
  }

  // ✅ Ajout ligne inventaire dans une session
  // POST /inventory/lines  { inventorySessionId, category, label|name, unit, qty }
  @Post('lines')
  async addLine(@Body() body: any) {
    const inventorySessionId = body?.inventorySessionId || body?.inventory_session_id;
    const category = body?.category;
    const name = body?.label || body?.name;
    const unit = body?.unit || 'piece';
    const qty = body?.qty ?? body?.default_qty ?? 1;

    if (!inventorySessionId) throw new BadRequestException('Missing inventorySessionId');
    if (!name) throw new BadRequestException('Missing label/name');

    return this.inventory.addLineToSession(
      String(inventorySessionId),
      String(category || 'Divers'),
      String(name),
      String(unit),
      Number(qty),
    );
  }

  @Patch('lines/:id')
  async patchLine(@Param('id') id: string, @Body() body: any) {
    return this.inventory.updateLine(id, body);
  }

  @Delete('lines/:id')
  async removeLine(@Param('id') id: string) {
    return this.inventory.removeLineFromSession(id);
  }

  @Post('copy-entry-to-exit')
  async copyEntryToExit(@Query('leaseId') leaseId?: string, @Query('lease_id') lease_id?: string) {
    const id = leaseId || lease_id;
    if (!id) throw new BadRequestException('Missing leaseId');
    return this.inventory.copyEntryToExit(id);
  }

  @Post('reference')
  async setReference(
    @Query('leaseId') leaseId?: string,
    @Query('inventorySessionId') inventorySessionId?: string,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    return this.inventory.setInventoryReferenceFromLease(leaseId, inventorySessionId);
  }

  @Post('apply-reference')
  async applyReference(
    @Query('leaseId') leaseId?: string,
    @Query('status') status?: string,
  ) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    return this.inventory.applyInventoryReferenceToLease(leaseId, status || 'entry');
  }
}
