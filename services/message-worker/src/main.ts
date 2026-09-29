import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const logger = new Logger('MessageWorker');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/worker');

  const port = process.env.PORT || 3004;
  await app.listen(port);
  logger.log(`Message Worker is running on http://localhost:${port}/api/worker`);
}

bootstrap();
