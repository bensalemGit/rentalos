import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ✅ All routes now start with /api
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT || 4000);
}
bootstrap();
