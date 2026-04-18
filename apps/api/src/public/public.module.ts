import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { CanonicalPublicLinksController } from './canonical-public-links.controller';
import { CanonicalPublicLinksService } from './canonical-public-links.service';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [AuthModule, DocumentsModule, MailerModule],
  controllers: [PublicController, CanonicalPublicLinksController],
  providers: [PublicService, CanonicalPublicLinksService],
  exports: [PublicService, CanonicalPublicLinksService],
})
export class PublicModule {}