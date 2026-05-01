import { Module } from '@nestjs/common';
import { LeasesController } from './leases.controller';
import { LeasesService } from './leases.service';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { LeaseDepositService } from './lease-deposit.service';
import { LeaseDepositController } from './lease-deposit.controller';

@Module({
  imports: [AuthModule, DocumentsModule],
  controllers: [LeasesController, LeaseDepositController],
  providers: [LeasesService, LeaseDepositService],
})
export class LeasesModule {}