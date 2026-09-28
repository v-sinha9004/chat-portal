import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { getGatewayConfig } from './config/configuration';
import { registerServiceProxies } from './proxy/proxy.middleware';
import { getServicesConfig } from './proxy/proxy.config';
import * as http from 'http';

async function bootstrap() {
  const logger = new Logger('ApiGateway');
  const config = getGatewayConfig();

  const app = await NestFactory.create(AppModule);

  // Configure CORS
  app.enableCors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(','),
    credentials: true,
  });

  const server: http.Server = app.getHttpServer();

  // Register all configured downstream service proxies
  const services = getServicesConfig();
  registerServiceProxies(app, server, services);

  await app.listen(config.port);
  logger.log(`API Gateway is running on http://localhost:${config.port}`);
  for (const s of services) {
    logger.log(
      `Proxy route active: [${s.name}] -> [${s.pathPrefixes.join(', ')}] -> ${s.target} (ws: ${!!s.ws})`,
    );
  }
}

bootstrap();
