import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EdlController } from './edl.controller';
import { EdlService } from './edl.service';

@Module({
  imports: [AuthModule],
  controllers: [EdlController],
  providers: [EdlService],
})
export class EdlModule {}
