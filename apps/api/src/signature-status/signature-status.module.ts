import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SignatureStatusController } from './signature-status.controller';
import { SignatureStatusService } from './signature-status.service';

@Module({
  imports: [AuthModule],
  controllers: [SignatureStatusController],
  providers: [SignatureStatusService],
})
export class SignatureStatusModule {}