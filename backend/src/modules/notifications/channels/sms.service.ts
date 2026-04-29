import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async send(phone: string, message: string) {
    if (!phone) {
      return false;
    }

    const apiKey = process.env.AFRICASTALKING_API_KEY || process.env.AT_API_KEY;
    const username =
      process.env.AFRICASTALKING_USERNAME || process.env.AT_USERNAME || 'sandbox';

    if (!apiKey) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(`[SMS DEV] -> ${phone}: ${message.slice(0, 80)}`);
        return true;
      }
      return false;
    }

    const body = new URLSearchParams({
      username,
      to: phone,
      message,
    });

    await axios.post('https://api.africastalking.com/version1/messaging', body, {
      headers: {
        apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      timeout: 5000,
    });

    return true;
  }
}
