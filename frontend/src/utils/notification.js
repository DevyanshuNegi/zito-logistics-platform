const fetch = require('node-fetch');

// EMAIL FUNCTION
const sendEmail = async (to, subject, html) => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[EMAIL DEV] ${to} | ${subject}`);
    return;
  }

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'VG Logistics <onboarding@resend.dev>',
        to: [to],
        subject,
        html
      })
    });
  } catch (err) {
    console.error('Email error:', err.message);
  }
};


// SMS FUNCTION (for now console only)
const sendSMS = async (phone, message) => {
  console.log(`[SMS] ${phone}: ${message}`);
};


module.exports = {
  sendEmail,
  sendSMS
};