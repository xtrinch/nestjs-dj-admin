import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ensureDemoDatabase } from './database/ensure-demo-database.js';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  await ensureDemoDatabase();
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:5173'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  await app.listen(Number(process.env['PORT'] ?? 3000), '127.0.0.1');
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
