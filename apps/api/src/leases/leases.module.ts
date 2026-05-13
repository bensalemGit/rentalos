import { Module } from '@nestjs/common';
import { LeasesController } from './leases.controller';
import { LeasesService } from './leases.service';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { LeaseDepositService } from './lease-deposit.service';
import { LeaseDepositController } from './lease-deposit.controller';
import { MailerModule } from '../mailer/mailer.module';
import { LeaseAmendmentsController } from './lease-amendments.controller';
import { LeaseAmendmentsService } from './lease-amendments.service';

@Module({
  imports: [AuthModule, DocumentsModule, MailerModule],
  controllers: [LeasesController, LeaseDepositController, LeaseAmendmentsController],
  providers: [LeasesService, LeaseDepositService, LeaseAmendmentsService],
})
export class LeasesModule {}