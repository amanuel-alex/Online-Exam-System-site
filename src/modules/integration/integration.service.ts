import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { createHmac } from 'crypto';
import axios from 'axios';
import { WebhookEvent } from '@prisma/client';

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * National Data Dispatcher (LMS / Government Webhooks)
   * 
   * Asynchronously notifies external systems of critical platform events.
   * Uses HMAC-SHA256 signing for payload integrity & authenticity.
   */
  async dispatchWebhook(event: WebhookEvent, payload: any, organizationId: string) {
    const activeHooks = await this.prisma.webhookConfig.findMany({
      where: { organizationId, events: { has: event }, isActive: true },
    });

    if (activeHooks.length === 0) return;

    for (const hook of activeHooks) {
      const timestamp = Date.now();
      const body = JSON.stringify({ event, payload, timestamp });
      
      // Cryptographic Signing (HMAC-SHA256)
      const signature = createHmac('sha256', hook.secret)
        .update(body)
        .digest('hex');

      // Dispatch as fire-and-forget background task
      axios.post(hook.url, body, {
        headers: {
          'Content-Type': 'application/json',
          'X-Examina-Signature': signature,
          'X-Examina-Event': event,
          'X-Examina-Timestamp': timestamp.toString(),
        },
        timeout: 5000,
      }).catch((err) => {
        this.logger.error(`Webhook Delivery Failed [${hook.url}]: ${err.message}`);
      });
    }
  }
}
