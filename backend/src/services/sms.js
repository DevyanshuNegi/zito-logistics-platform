const axios = require('axios');

const AT_USERNAME = process.env.AT_USERNAME || 'sandbox';
const AT_API_KEY = process.env.AT_API_KEY || 'atsk_test_key';
const AT_SENDER_ID = process.env.AT_SENDER_ID || 'ZITO';
const AT_BASE_URL = 'https://api.sandbox.africastalking.com/version1';

const sendSMS = async ({ phone, message }) => {
  try {
    const response = await axios.post(
      `${AT_BASE_URL}/messaging`,
      new URLSearchParams({
        username: AT_USERNAME,
        to: phone,
        message: message,
        from: AT_SENDER_ID,
      }),
      {
        headers: {
          apiKey: AT_API_KEY,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    console.log('SMS sent:', response.data);
    return response.data;
  } catch (err) {
    console.error('SMS error:', err.message);
    return null;
  }
};

const sendBookingConfirmation = async ({ phone, full_name, reference, pickup, delivery }) => {
  const message = `Dear ${full_name}, your booking ${reference} has been confirmed. Pickup: ${pickup}. Delivery: ${delivery}. ZITO (VG Global Logistics).`;
  return sendSMS({ phone, message });
};

const sendDriverAssigned = async ({ phone, full_name, reference, driver_name, driver_phone }) => {
  const message = `Dear ${full_name}, driver ${driver_name} (${driver_phone}) has been assigned to your booking ${reference}. ZITO (VG Global Logistics).`;
  return sendSMS({ phone, message });
};

const sendBookingCompleted = async ({ phone, full_name, reference, amount }) => {
  const message = `Dear ${full_name}, booking ${reference} completed. Amount due: KES ${amount}. Thank you for using ZITO (VG Global Logistics).`;
  return sendSMS({ phone, message });
};

module.exports = { sendSMS, sendBookingConfirmation, sendDriverAssigned, sendBookingCompleted };