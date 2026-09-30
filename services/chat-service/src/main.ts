import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { RedisIoAdapter } from './socket/redis-io.adapter';

dotenv.config();

async function bootstrap() {
  const logger = new Logger('ChatService');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/chat');

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Chat Service is running on http://localhost:${port}/api/chat`);
}

bootstrap();
