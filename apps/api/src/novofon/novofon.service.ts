import { createHash, createHmac } from 'crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NovofonService {
  private readonly log = new Logger(NovofonService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.userKey() && this.secret());
  }

  async startCallback(to: string) {
    if (this.isConfigured()) {
      const from = this.config.get<string>('NOVOFON_FROM')?.trim();
      if (!from) {
        throw new ServiceUnavailableException({ error: 'novofon_from_missing' });
      }
      return this.call('/v1/request/callback/', { from, to });
    }
    return this.call('/v1/request/callback/', { to });
  }

  async sendSms(to: string, message: string) {
    const params: Record<string, string> = { number: to, message };
    const callerId = this.config.get<string>('NOVOFON_SMS_CALLER_ID')?.trim();
    if (callerId) params.caller_id = callerId;
    return this.call('/v1/sms/send/', params);
  }

  private async call(method: string, params: Record<string, string>) {
    if (!this.isConfigured()) {
      this.log.warn(`Novofon is not configured, skip ${method} to ${params.to ?? params.number}`);
      return { status: 'stub' as const };
    }

    const query = Object.keys(params)
      .sort()
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key]).replace(/%20/g, '+')}`)
      .join('&');
    const md5 = createHash('md5').update(query).digest('hex');
    const sign = createHmac('sha1', this.secret())
      .update(method + query + md5)
      .digest('base64');
    const base = this.config.get<string>('NOVOFON_API_URL') ?? 'https://api.novofon.com';
    const url = `${base.replace(/\/$/, '')}${method}?${query}`;
    const response = await fetch(url, {
      headers: { Authorization: `${this.userKey()}:${sign}` },
    });
    const payload = (await response.json().catch(() => ({}))) as { status?: string; message?: string };
    if (!response.ok || payload.status === 'error') {
      this.log.error(`Novofon ${method} failed: ${response.status} ${JSON.stringify(payload)}`);
      throw new ServiceUnavailableException({ error: 'novofon_failed' });
    }
    return payload;
  }

  private userKey() {
    return this.config.get<string>('NOVOFON_USER_KEY')?.trim() ?? '';
  }

  private secret() {
    return this.config.get<string>('NOVOFON_SECRET')?.trim() ?? '';
  }
}

export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    return `7${digits.slice(1)}`;
  }
  return digits;
}
