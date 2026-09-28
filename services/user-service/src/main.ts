import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';

dotenv.config();

async function bootstrap() {
  const logger = new Logger('UserService');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/users');

  const port = process.env.PORT || 3002;
  await app.listen(port);
  logger.log(`User Service is running on http://localhost:${port}/api/users`);
}

bootstrap();
