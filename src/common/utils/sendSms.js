import axios from "axios";
const ONE_SMS_API = process.env.ONE_SMS_API;
const SENDER_ID = process.env.SENDER_ID || "COUNTM";
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const AUTH_KEY = process.env.AUTH_KEY;

export const sendOTPViaSMS = async (phone, message) => {
  try {
    const data = {
      Text: message,
      Number: "91" + phone, // Append Indian country code 91
      SenderId: SENDER_ID,
    };

    const authHeader =
      "Basic " + Buffer.from(`${AUTH_KEY}:${AUTH_TOKEN}`).toString("base64");

    console.log(`Sending SMS to ${phone}... Message: ${message}`);

    const response = await axios.post(ONE_SMS_API, data, {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      timeout: 10000, // 10s timeout
    });

    console.log("SMS API Response:", {
      status: response.status,
      data: response.data,
    });

    return response.status >= 200 && response.status < 300;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // console.log('[DEV] Mocking SMS delivery success.');
      return true;
    }
    return false;
  }
};
