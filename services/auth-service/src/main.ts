import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';

dotenv.config();

async function bootstrap() {
  const logger = new Logger('AuthService');
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.setGlobalPrefix('api/auth');

  const port = process.env.PORT || 3003;
  await app.listen(port);
  logger.log(`Auth Service is running on http://localhost:${port}/api/auth`);
}

bootstrap();
