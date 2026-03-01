import { Module } from '@nestjs/common';
import { GuaranteesController } from './guarantees.controller';
import { GuaranteesService } from './guarantees.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // ✅ IMPORTANT pour JwtGuard/JwtService
  controllers: [GuaranteesController],
  providers: [GuaranteesService],
  exports: [GuaranteesService],
})
export class GuaranteesModule {}