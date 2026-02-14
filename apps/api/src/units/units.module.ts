import { Module } from '@nestjs/common';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';
import { AuthModule } from '../auth/auth.module';
import { UnitReferencesModule } from '../unit-references/unit-references.module';

@Module({
  imports: [AuthModule, UnitReferencesModule],
  controllers: [UnitsController],
  providers: [UnitsService],
})
export class UnitsModule {}
