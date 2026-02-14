import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { UnitReferencesController } from './unit-references.controller';
import { UnitReferencesService } from './unit-references.service';

export const PG_POOL = 'PG_POOL';

@Module({
  controllers: [UnitReferencesController],
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => {
        return new Pool({
          connectionString: process.env.DATABASE_URL,
        });
      },
    },
    UnitReferencesService,
  ],
  // ✅ AJOUTE ÇA
  exports: [PG_POOL, UnitReferencesService],
})
export class UnitReferencesModule {}
