const axios = require('axios');

const MPESA_BASE_URL = 'https://sandbox.safaricom.co.ke';
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || 'GzkDGiXkLUkSqhOcgMIzCpbn4J6CZmPH';
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || 'oMBMzIvMcGfJGXxP';
const SHORTCODE = process.env.MPESA_SHORTCODE || '174379';
const PASSKEY = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL || 'https://webhook.site/test-vg-logistics';

const getAccessToken = async () => {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  const response = await axios.get(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return response.data.access_token;
};

const stkPush = async ({ phone, amount, bookingReference }) => {
  const token = await getAccessToken();
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

  const response = await axios.post(
    `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
    {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: CALLBACK_URL,
      AccountReference: bookingReference,
      TransactionDesc: `Payment for ${bookingReference}`,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return response.data;
};

/**
 * B2C Disbursement — PRD §15
 * Send funds from Zito Business account to Driver's phone
 */
const b2cDisbursement = async ({ phone, amount, remarks, occasion }) => {
  const token = await getAccessToken();
  const response = await axios.post(
    `${MPESA_BASE_URL}/mpesa/b2c/v1/paymentrequest`,
    {
      InitiatorName: process.env.MPESA_INITIATOR_NAME || 'testapi',
      SecurityCredential: process.env.MPESA_INITIATOR_PASSWORD || 'password',
      CommandID: 'SalaryPayment', // or 'BusinessPayment'
      Amount: amount,
      PartyA: SHORTCODE,
      PartyB: phone,
      Remarks: remarks || 'Zito Driver Payout',
      QueueTimeOutURL: CALLBACK_URL,
      ResultURL: CALLBACK_URL,
      Occasion: occasion || 'Payout'
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return response.data;
};

module.exports = { stkPush, getAccessToken, b2cDisbursement };