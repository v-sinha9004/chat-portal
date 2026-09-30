import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  async connectToRedis(): Promise<void> {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);

    try {
      const pubClient = new Redis({
        host,
        port,
        lazyConnect: false,
        retryStrategy: (times) => Math.min(times * 100, 3000),
      });

      const subClient = pubClient.duplicate();

      pubClient.on('error', (err) => {
        this.logger.error(`Redis IoAdapter PubClient error: ${err.message}`);
      });

      subClient.on('error', (err) => {
        this.logger.error(`Redis IoAdapter SubClient error: ${err.message}`);
      });

      await Promise.all([
        new Promise<void>((resolve) => {
          if (pubClient.status === 'ready') resolve();
          else pubClient.once('ready', () => resolve());
        }),
        new Promise<void>((resolve) => {
          if (subClient.status === 'ready') resolve();
          else subClient.once('ready', () => resolve());
        }),
      ]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log(`Socket.IO Redis adapter connected successfully on ${host}:${port}`);
    } catch (err: any) {
      this.logger.warn(
        `Could not connect Socket.IO Redis adapter: ${err.message}. Falling back to default in-memory adapter.`,
      );
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
