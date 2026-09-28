import { Injectable } from '@nestjs/common';
import { getGatewayConfig } from './config/configuration';
import { getServicesConfig } from './proxy/proxy.config';

@Injectable()
export class AppService {
  private readonly config = getGatewayConfig();

  getRootInfo() {
    const services = getServicesConfig();
    const routingMap = services.map((s) => ({
      service: s.name,
      target: s.target,
      prefixes: s.pathPrefixes,
      websocket: s.ws ?? false,
    }));

    return {
      name: 'API Gateway',
      version: '1.0.0',
      status: 'running',
      gatewayHealth: '/health',
      proxiedServices: routingMap,
    };
  }

  async getHealth() {
    const services = getServicesConfig();

    // Deduplicate unique service targets for health checks
    const targetMap = new Map<string, { serviceName: string; healthPath: string }>();
    for (const s of services) {
      if (!targetMap.has(s.target)) {
        targetMap.set(s.target, {
          serviceName: s.name,
          healthPath: s.healthPath || '/health',
        });
      }
    }

    const downstreamHealth: Record<string, any> = {};

    for (const [targetUrl, { serviceName, healthPath }] of targetMap.entries()) {
      let status = 'unknown';
      let data: any = null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        let res = await fetch(`${targetUrl}${healthPath}`, {
          signal: controller.signal,
        });
        if (!res.ok && healthPath !== '/health') {
          const fallbackRes = await fetch(`${targetUrl}/health`, {
            signal: controller.signal,
          });
          if (fallbackRes.ok) {
            res = fallbackRes;
          }
        }
        clearTimeout(timeoutId);

        if (res.ok) {
          status = 'reachable';
          try {
            data = await res.json();
          } catch {
            data = 'ok';
          }
        } else {
          status = `error (HTTP ${res.status})`;
        }
      } catch (err: any) {
        status = `unreachable (${err.message})`;
      }

      downstreamHealth[serviceName] = {
        url: targetUrl,
        status,
        data,
      };
    }

    return {
      status: 'ok',
      gateway: {
        port: this.config.port,
        uptime: `${Math.floor(process.uptime())}s`,
        timestamp: new Date().toISOString(),
      },
      downstream: downstreamHealth,
    };
  }
}
