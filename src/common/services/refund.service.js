import axios from "axios";

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_ENV = process.env.CASHFREE_ENV || "test";

const CASHFREE_BASE_URL =
  CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg/orders"
    : "https://sandbox.cashfree.com/pg/orders";

export const createRefund = async ({ paymentId, amount, notes = {} }) => {
  try {
    const refundId = `REFUND_${Date.now()}`;
    const postData = {
      refund_amount: amount,
      refund_id: refundId,
      refund_note: notes?.reason || "Refund requested",
      refund_speed: "STANDARD",
    };

    const response = await axios.post(
      `${CASHFREE_BASE_URL}/${paymentId}/refunds`,
      postData,
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-version": "2022-09-01",
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
        },
        timeout: 15000,
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Cashfree Refund Error:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Failed to process Cashfree refund");
  }
};
