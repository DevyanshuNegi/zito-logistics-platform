// src/services/sms.service.js
// Lightweight SMS abstraction with a safe default (console log).
// Supports:
//  - DRY_RUN / missing creds: logs only
//  - AfricasTalking (already in dependencies) when env vars present

const AFRICASTALKING = 'africastalking';

const provider = (process.env.SMS_PROVIDER || '').toLowerCase();
const isDryRun = process.env.SMS_DRY_RUN === 'true' || !provider;

let atClient = null;
if (provider === AFRICASTALKING && process.env.AT_API_KEY && process.env.AT_USERNAME) {
  const africastalking = require('africastalking')({
    apiKey:   process.env.AT_API_KEY,
    username: process.env.AT_USERNAME,
  });
  atClient = africastalking.SMS;
}

const sendSms = async ({ to, message }) => {
  if (!to || !message) throw new Error('to and message are required for SMS');

  if (isDryRun || !atClient) {
    console.log(`[SMS:DRY_RUN] to=${to} message="${message}" provider=${provider || 'none'}`);
    return { dryRun: true };
  }

  if (provider === AFRICASTALKING) {
    const res = await atClient.send({ to, message, enqueue: true, from: process.env.AT_SENDER_ID });
    return res;
  }

  console.log(`[SMS:UNKNOWN_PROVIDER] to=${to} message="${message}"`);
  return { dryRun: true };
};

module.exports = { sendSms };
