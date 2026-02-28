import { Module } from '@nestjs/common';
import { LeasesController } from './leases.controller';
import { LeasesService } from './leases.service';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module'; // ✅ ajout

@Module({
  imports: [
    AuthModule,
    DocumentsModule, // ✅ ajout ici
  ],
  controllers: [LeasesController],
  providers: [LeasesService],
})
export class LeasesModule {}
