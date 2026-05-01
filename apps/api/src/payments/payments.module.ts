import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ReceiptsService } from '../receipts/receipts.service';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [AuthModule, MailerModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, ReceiptsService],
})
export class PaymentsModule {}