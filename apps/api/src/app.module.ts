import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { UnitsModule } from './units/units.module';
import { TenantsModule } from './tenants/tenants.module';
import { LeasesModule } from './leases/leases.module';
import { EdlModule } from './edl/edl.module';
import { InventoryModule } from './inventory/inventory.module';
import { DocumentsModule } from './documents/documents.module';
import { PublicModule } from './public/public.module';

import { MailerModule } from './mailer/mailer.module';
import { PaymentsModule } from './payments/payments.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { ProjectsModule } from './projects/projects.module';
import { BuildingsModule } from './buildings/buildings.module';
import { ImportModule } from './import/import.module';
import { UnitReferencesModule } from './unit-references/unit-references.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UnitsModule,
    TenantsModule,
    LeasesModule,
    EdlModule,
    InventoryModule,
	UnitReferencesModule,
    DocumentsModule,
    PublicModule,
    MailerModule,
    PaymentsModule,
    ReceiptsModule,
	ProjectsModule,
	BuildingsModule,
	ImportModule,
  ],
})
export class AppModule {}
