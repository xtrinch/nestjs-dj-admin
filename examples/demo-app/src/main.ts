import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
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

  app.use((request: Request, _response: Response, next: NextFunction) => {
    request.user = {
      id: request.header('x-admin-user-id') ?? 'demo-admin',
      role: request.header('x-admin-role') ?? 'admin',
    };
    next();
  });

  const frontendDist = join(process.cwd(), 'dist', 'admin-ui');
  if (existsSync(frontendDist)) {
    const http = app.getHttpAdapter().getInstance();
    http.use('/admin', express.static(frontendDist, { index: false }));
    http.get('/admin', (_request: Request, response: Response) => {
      response.sendFile(join(frontendDist, 'index.html'));
    });
    http.get('/admin/', (_request: Request, response: Response) => {
      response.sendFile(join(frontendDist, 'index.html'));
    });
  }

  await app.listen(3000, '127.0.0.1');
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
