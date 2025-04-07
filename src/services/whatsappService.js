const twilio = require('twilio');

// Initialize Twilio client with your credentials
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const sendOTPWhatsApp = async (contactNumber, otp) => {
  try {
    // Ensure contactNumber is in international format (e.g., +1234567890)
    const formattedNumber = contactNumber.startsWith('+') 
      ? `whatsapp:${contactNumber}` 
      : `whatsapp:+${contactNumber}`;

    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER, // e.g., whatsapp:+14155238886
      to: formattedNumber,
      body: `Your verification OTP is: ${otp}. It expires in 10 minutes.`
    });

    console.log(`OTP sent to ${contactNumber}: ${message.sid} ${otp}`);
  } catch (error) {
    throw new Error(`Failed to send OTP via WhatsApp: ${error.message}`);
  }
};

module.exports = { sendOTPWhatsApp };