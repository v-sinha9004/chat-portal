import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const logger = new Logger('ChatService');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/chat');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Chat Service is running on http://localhost:${port}/api/chat`);
}

bootstrap();
