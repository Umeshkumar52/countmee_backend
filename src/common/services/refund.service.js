import razorpay from "../../config/razorpay";

export const createRefund = async ({ paymentId, amount, notes = {} }) => {
  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amount * 100,

      speed: "normal",

      notes,
    });

    return refund;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
