import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { ImportService } from './import.service';

type ImportHousingDto = {
  leaseId: string;
  typology: string; // "Studio" | "T1" | "T2" | ... "T4" etc
  furnished?: boolean;
  duplex?: boolean;
  variants?: string[]; // ["BALCON","PARKING","CAVE","JARDIN","CUISINE_EQUIPEE","BUANDERIE",...]
  mode?: 'block_if_data' | 'merge'; // MVP: block_if_data
};

@Controller('import')
@UseGuards(JwtGuard)
export class ImportController {
  constructor(private readonly svc: ImportService) {}

  @Post('housing')
  importHousing(@Body() body: ImportHousingDto) {
    return this.svc.importHousing(body);
  }
}
