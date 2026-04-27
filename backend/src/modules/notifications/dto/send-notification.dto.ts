export class SendNotificationDto {
  userId: string;
  message: string;
  channel?: 'SMS' | 'EMAIL' | 'PUSH';
}