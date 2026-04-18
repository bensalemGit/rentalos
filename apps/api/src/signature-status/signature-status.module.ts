import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SignatureStatusController } from './signature-status.controller';
import { SignatureStatusService } from './signature-status.service';
import { SignatureWorkflowController } from './signature-workflow.controller';
import { SignatureWorkflowService } from './signature-workflow.service';

@Module({
  imports: [AuthModule],
  controllers: [SignatureStatusController, SignatureWorkflowController],
  providers: [SignatureStatusService, SignatureWorkflowService],
  exports: [SignatureStatusService, SignatureWorkflowService],
})
export class SignatureStatusModule {}