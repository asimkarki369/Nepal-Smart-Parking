const axios = require('axios');

// In dev mode, OTP is always process.env.DEV_OTP (default: 123456)
// In production, sends real SMS via Sparrow SMS (Nepal)

async function sendOTP(phone, otp) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] OTP for ${phone}: ${otp}`);
    return;
  }

  const message = `Your Nepal Smart Parking OTP is: ${otp}. Valid for ${process.env.OTP_EXPIRY_MINUTES} minutes. Do not share.`;

  await axios.post('https://api.sparrowsms.com/v2/sms/', {
    token: process.env.SPARROW_SMS_TOKEN,
    from: process.env.SPARROW_SMS_FROM || 'NSP',
    to: `977${phone}`,
    text: message,
  });
}

module.exports = { sendOTP };
