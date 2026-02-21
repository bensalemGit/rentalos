import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { AuthModule } from '../auth/auth.module';
import { LandlordController } from './landlord.controller';
import { LandlordService } from './landlord.service';

@Module({
  imports: [AuthModule],              // ✅ needed for JwtGuard/JwtService
  controllers: [ProjectsController, LandlordController],
  providers: [ProjectsService, LandlordService],
  exports: [ProjectsService, LandlordService],
})
export class ProjectsModule {}
