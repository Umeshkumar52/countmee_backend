import * as paymentsRepository from "./payments.repository.js";
import { Order } from "../orders/order.model.js";
import { User } from "../users/user.model.js";
import { Wallet } from "./wallet.model.js";
import { WalletTransaction } from "./walletTransaction.model.js";
import { sendNotification } from "../../common/utils/sendNotification.js";
import { ROLES } from "../../constants/index.js";
import { notifyDp } from "../orders/orders.service.js";
import axios from "axios";
import mongoose from "mongoose";
import ApiError from "../../common/utils/ApiError.js";
import { Payment } from "./payment.model.js";

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_ENV = process.env.CASHFREE_ENV || "test";

const CASHFREE_BASE_URL =
  CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg/orders"
    : "https://sandbox.cashfree.com/pg/orders";

// Razorpay payment

export const cashfreeWebhook = async (data) => {
  if (data.type === "PAYMENT_SUCCESS_WEBHOOK") {
    const orderId = data.data.order.order_id;
    const paymentStatus = data.data.payment.payment_status;

    if (paymentStatus === "SUCCESS") {
      const transaction =
        await paymentsRepository.findTransactionByGatewayId(orderId);
      if (transaction && transaction.status === "pending") {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          transaction.status = "completed";
          await transaction.save({ session });

          const wallet = await Wallet.findById(transaction.wallet_id);
          wallet.balance += transaction.amount;
          await wallet.save({ session });

          await sendNotification({
            role: ROLES.USER,
            userId: wallet.user_id,
            title: "Wallet Recharged",
            message: `Your wallet has been credited with ₹${transaction.amount} via Cashfree.`,
            session,
          });

          await session.commitTransaction();
          session.endSession();
          console.log(`Cashfree Webhook: Payment Successful for order ${orderId}`);
        } catch (err) {
          await session.abortTransaction();
          session.endSession();
          console.error("Cashfree Webhook Error:", err);
        }
      }
    }
  }

  // Payment failed
  if (data.type === "PAYMENT_FAILED_WEBHOOK") {
    const orderId = data.data.order.order_id;
    const transaction =
      await paymentsRepository.findTransactionByGatewayId(orderId);
    if (transaction && transaction.status === "pending") {
      transaction.status = "failed";
      await transaction.save();
    }
    console.log(`Cashfree Webhook: Payment Failed for order ${orderId}`);
  }
};

export const getBalance = async (user_id) => {
  let wallet = await paymentsRepository.findWalletByUserId(user_id);
  if (!wallet) {
    wallet = await paymentsRepository.createWallet({ user_id, balance: 0 });
  }
  return wallet.balance;
};

export const getHistory = async (user_id, page = 1) => {
  const wallet = await paymentsRepository.findWalletByUserId(user_id);
  if (!wallet) {
    return { current_page: 1, total_page: 0, total_no_data: 0, data: [] };
  }

  const history = await paymentsRepository.getHistoryPaginated(
    wallet._id,
    page,
    10,
  );
  return {
    current_page: history.currentPage,
    total_page: history.totalPages,
    total_no_data: history.total,
    data: history.items,
  };
};

export const payOrder = async (user_id, order_id, amount) => {
  const wallet = await paymentsRepository.findWalletByUserId(user_id);
  if (!wallet || wallet.balance < amount) {
    throw new Error("Insufficient wallet balance");
  }

  const order = await Order.findById(order_id);
  if (!order) {
    throw new Error("Order not found");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Deduct from wallet
    wallet.balance -= amount;
    await wallet.save({ session });

    // Log transaction
    await paymentsRepository.createWalletTransaction(
      {
        wallet_id: wallet._id,
        amount,
        type: "debit",
        description: `Payment for Order #${order._id}`,
        transaction_type: "order_payment",
        reference_id: order._id,
        status: "completed",
      },
      session,
    );

    // Update order status
    order.status = 1; // Paid/Active
    await order.save({ session });

    // Notify DP
    await notifyDp(order._id, order.package_id);

    // Create success notification
    await sendNotification({
      role: ROLES.USER,
      userId: order.user_id,
      title: "Payment Successful",
      message: `Payment of ₹${amount} for Order #${order._id} completed via Wallet`,
      orderId: order._id,
      session,
    });

    await session.commitTransaction();
    session.endSession();

    return true;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const recharge = async (
  user_id,
  amount,
  transaction_id,
  payment_method,
  status,
) => {
  let wallet = await paymentsRepository.findWalletByUserId(user_id);
  if (!wallet) {
    wallet = await paymentsRepository.createWallet({ user_id, balance: 0 });
  }

  const isSuccessful = ["PAID", "SUCCESS", "COMPLETED"].includes(
    status.toUpperCase(),
  );

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const transaction = await paymentsRepository.createWalletTransaction(
      {
        wallet_id: wallet._id,
        amount,
        type: "credit",
        description: `Wallet Recharge via ${payment_method}`,
        transaction_type: "recharge",
        transaction_id,
        payment_method,
        status: isSuccessful ? "completed" : "failed",
      },
      session,
    );

    if (isSuccessful) {
      wallet.balance += Number(amount);
      await wallet.save({ session });

      await sendNotification({
        role: ROLES.USER,
        userId: user_id,
        title: "Wallet Recharged",
        message: `Your wallet has been credited with ₹${amount}. Transaction ID: ${transaction_id}`,
        session,
      });

      await session.commitTransaction();
      session.endSession();

      return {
        balance: wallet.balance,
        transaction_id: transaction[0]._id,
      };
    } else {
      await session.commitTransaction();
      session.endSession();
      throw new Error("Payment status is not successful");
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const initiateCashfreePayment = async (user_id, amount) => {
  const user = await User.findById(user_id);
  if (!user) {
    throw new Error("User not found");
  }

  const orderId = `WAL_${user._id}_${Date.now()}`;

  const postData = {
    order_id: orderId,
    order_amount: amount,
    order_currency: "INR",
    customer_details: {
      customer_id: String(user._id),
      customer_email: user.email || "customer@countmee.in",
      customer_phone: user.phone,
    },
    order_meta: {
      return_url: `https://countmee.in/payment-status?order_id=${orderId}`,
    },
  };

  try {
    const response = await axios.post(CASHFREE_BASE_URL, postData, {
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2022-09-01",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
      },
      timeout: 15000,
    });

    const result = response.data;

    if (result.payment_session_id) {
      let wallet = await paymentsRepository.findWalletByUserId(user._id);
      if (!wallet) {
        wallet = await paymentsRepository.createWallet({
          user_id: user._id,
          balance: 0,
        });
      }

      await paymentsRepository.createWalletTransaction({
        wallet_id: wallet._id,
        amount,
        type: "credit",
        description: "Pending Cashfree Recharge",
        transaction_type: "recharge",
        transaction_id: orderId,
        payment_method: "Cashfree",
        status: "pending",
      });

      return {
        order_id: orderId,
        payment_session_id: result.payment_session_id,
      };
    }
    throw new Error("Failed to retrieve payment_session_id from Cashfree API");
  } catch (error) {
    console.error(
      "Cashfree Initiate Error:",
      error.response ? error.response.data : error.message,
    );
    throw new Error("Failed to create Cashfree order");
  }
};

export const verifyCashfreePayment = async (order_id) => {
  try {
    const response = await axios.get(`${CASHFREE_BASE_URL}/${order_id}`, {
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2022-09-01",
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
      },
      timeout: 15000,
    });

    const result = response.data;

    if (result.order_status === "PAID") {
      const transaction =
        await paymentsRepository.findTransactionByGatewayId(order_id);
      if (transaction && transaction.status === "pending") {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          transaction.status = "completed";
          await transaction.save({ session });

          const wallet = await Wallet.findById(transaction.wallet_id);
          wallet.balance += transaction.amount;
          await wallet.save({ session });

          await sendNotification({
            role: ROLES.USER,
            userId: wallet.user_id,
            title: "Wallet Recharged",
            message: `Your wallet has been credited with ₹${transaction.amount} via Cashfree.`,
            session,
          });

          await session.commitTransaction();
          session.endSession();

          return {
            balance: wallet.balance,
          };
        } catch (err) {
          await session.abortTransaction();
          session.endSession();
          throw err;
        }
      }
      return { already_processed: true };
    }

    throw new Error("Payment verification failed");
  } catch (error) {
    console.error(
      "Cashfree Verify Error:",
      error.response ? error.response.data : error.message,
    );
    throw new Error("Payment verification failed");
  }
};

export const processRazorpayPayment = async (paymentData) => {
  const {
    customer_auth_id,
    order_id,
    razorpay_order_id,
    razorpay_payment_id,
    payment_mode,
    price,
    currency,
    status,
  } = paymentData;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const payment = await paymentsRepository.createPayment(
      {
        customer_auth_id,
        order_id,
        razorpay_order_id,
        razorpay_payment_id,
        payment_mode,
        price: Number(price),
        currency,
        status,
      },
      session,
    );

    if (status === "PAID") {
      const order = await Order.findById(order_id);
      if (order) {
        order.status = 1;
        await order.save({ session });

        // Notify DP
        await notifyDp(order._id, order.package_id);

        // Notification logs
        await sendNotification({
          role: ROLES.USER,
          userId: order.user_id,
          title: "Payment Successful",
          message: `Payment of ₹${price} for Order #${order._id} completed`,
          orderId: order._id,
          session,
        });
      }

      await session.commitTransaction();
      session.endSession();

      return {
        success: "payment details save successfully",
      };
    } else {
      await session.commitTransaction();
      session.endSession();
      throw new Error("payment failed");
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};
