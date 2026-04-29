import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  async send(userId: string, title: string, body: string) {
    const serverKey = process.env.FCM_SERVER_KEY;

    if (!serverKey) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(`[PUSH DEV] -> ${userId}: ${title}`);
        return true;
      }
      return false;
    }

    await axios.post(
      'https://fcm.googleapis.com/fcm/send',
      {
        to: `/topics/user-${userId}`,
        notification: {
          title,
          body,
        },
        data: {
          userId,
        },
      },
      {
        headers: {
          Authorization: `key=${serverKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      },
    );

    return true;
  }
}
