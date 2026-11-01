import './load-env';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { AppModule } from './app.module';

// BigInt (size_bytes) → số khi trả JSON
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.disable('x-powered-by');
  app.enableShutdownHooks();
  await app.listen(env.PORT);
  Logger.log(`API: http://localhost:${env.PORT}/api/v1 · Drive: ${env.DRIVE_MODE} · Node ${process.version}`, 'Bootstrap');
}

void bootstrap();
