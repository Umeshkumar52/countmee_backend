import * as paymentsRepository from "./payments.repository.js";
import { Order } from "../orders/order.model.js";
import { User } from "../users/user.model.js";
import { Wallet } from "./wallet.model.js";
import { WalletTransaction } from "./walletTransaction.model.js";
import { sendNotification } from "../../common/utils/sendNotification.js";
import {
  ROLES,
  ORDER_STATUS,
  PAYOUT_STATUS,
  PAYMENT_STATUS,
} from "../../constants/index.js";
import { broadcastOrderToNearbyDPs } from "../orders/orders.service.js";
import { PackageDetail } from "../orders/packageDetail.model.js";
import axios from "axios";
import mongoose from "mongoose";
import ApiError from "../../common/utils/ApiError.js";
import { Payment } from "./payment.model.js";
import { randomBytes } from "crypto";

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_ENV = process.env.CASHFREE_ENV || "test";

const CASHFREE_BASE_URL =
  CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg/orders"
    : "https://sandbox.cashfree.com/pg/orders";

const createCashfreeOrderId = (prefix, referenceId) =>
  `${prefix}_${referenceId}_${Date.now()}_${randomBytes(4).toString("hex")}`;

const getCashfreeCustomerPhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "9999999999";
};

const getCashfreeErrorMessage = (error, fallbackMessage) => {
  const data = error.response?.data;
  const message =
    data?.message ||
    data?.error_description ||
    data?.error ||
    (typeof data === "string" ? data : null);

  return message ? `Cashfree Error: ${message}` : fallbackMessage;
};

// Razorpay payment

export const cashfreeWebhook = async (data) => {
  if (data.type === "PAYMENT_SUCCESS_WEBHOOK") {
    const orderId = data.data.order.order_id;
    const paymentStatus = data.data.payment.payment_status;

    if (paymentStatus === "SUCCESS") {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        if (orderId.startsWith("WAL_")) {
          // Wallet Recharge Logic
          const transaction = await WalletTransaction.findOneAndUpdate(
            { transaction_id: orderId, status: PAYOUT_STATUS.PENDING },
            { status: PAYOUT_STATUS.COMPLETED },
            { new: true, session },
          );

          if (transaction) {
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
            console.log(
              `Cashfree Webhook: Wallet Recharge Successful for ${orderId}`,
            );
          } else {
            await session.abortTransaction();
            console.log(
              `Cashfree Webhook: Wallet Recharge already processed for ${orderId}`,
            );
          }
        } else if (orderId.startsWith("DIR_")) {
          // Direct Order Payment Logic
          const payment = await Payment.findOneAndUpdate(
            { cf_order_id: orderId, status: PAYMENT_STATUS.ACTIVE },
            { status: "SUCCESS" },
            { new: true, session },
          );

          if (payment) {
            const order = await Order.findById(payment.order_id).session(
              session,
            );
            if (
              order &&
              [ORDER_STATUS.CREATED, ORDER_STATUS.SCHEDULED].includes(
                order.status,
              )
            ) {
              order.status = ORDER_STATUS.CONFIRMED;
              order.payment_id = payment._id;
              await order.save({ session });

              // Broadcast to DP if normal order
              const packageDetail = await PackageDetail.findById(
                order.package_id,
              ).session(session);
              if (packageDetail && order.order_type === "normal") {
                broadcastOrderToNearbyDPs(order, packageDetail).catch((err) =>
                  console.error("[Broadcast] Webhook execution failed:", err),
                );
              }

              await sendNotification({
                role: ROLES.USER,
                userId: order.user_id,
                title: "Payment Successful",
                message: `Direct payment of ₹${payment.amount} for Order #${order._id} completed successfully via Cashfree.`,
                session,
              });
            }
            await session.commitTransaction();
            console.log(
              `Cashfree Webhook: Direct Order Payment Successful for ${orderId}`,
            );
          } else {
            await session.abortTransaction();
            console.log(
              `Cashfree Webhook: Direct Order Payment already processed for ${orderId}`,
            );
          }
        } else if (orderId.startsWith("WAIT_")) {
          // Waiting Charge Payment Logic
          const payment = await Payment.findOneAndUpdate(
            { cf_order_id: orderId, status: "ACTIVE" },
            { status: "SUCCESS" },
            { new: true, session },
          );

          if (payment) {
            const { OrderWaitCharge } =
              await import("../orders/orderWaitCharge.model.js");
            const waitChargeDoc = await OrderWaitCharge.findOne({
              order_id: payment.order_id,
            }).session(session);
            if (waitChargeDoc && waitChargeDoc.payment_status === "unpaid") {
              waitChargeDoc.payment_status = "paid";
              waitChargeDoc.payment_method = "cashfree";
              waitChargeDoc.paid_at = new Date();
              await waitChargeDoc.save({ session });

              await sendNotification({
                role: ROLES.USER,
                userId: waitChargeDoc.user_id,
                title: "Waiting Charge Paid",
                message: `Waiting charge of ₹${payment.amount} for Order #${payment.order_id} completed successfully via Cashfree.`,
                session,
              });
            }
            await session.commitTransaction();
            console.log(
              `Cashfree Webhook: Waiting Charge Payment Successful for ${orderId}`,
            );
          } else {
            await session.abortTransaction();
            console.log(
              `Cashfree Webhook: Waiting Charge Payment already processed for ${orderId}`,
            );
          }
        } else {
          await session.abortTransaction();
          console.log(
            `Cashfree Webhook: Unknown order ID prefix for ${orderId}`,
          );
        }
      } catch (err) {
        await session.abortTransaction();
        console.error("Cashfree Webhook Error:", err);
      } finally {
        session.endSession();
      }
    }
  }

  // Payment failed
  if (data.type === "PAYMENT_FAILED_WEBHOOK") {
    const orderId = data.data.order.order_id;
    if (orderId.startsWith("WAL_")) {
      await WalletTransaction.findOneAndUpdate(
        { transaction_id: orderId, status: PAYOUT_STATUS.PENDING },
        { status: PAYMENT_STATUS.FAILED },
      );
      console.log(`Cashfree Webhook: Wallet Recharge Failed for ${orderId}`);
    } else if (orderId.startsWith("DIR_")) {
      await Payment.findOneAndUpdate(
        { cf_order_id: orderId, status: PAYMENT_STATUS.ACTIVE },
        { status: "FAILED" },
      );
      console.log(
        `Cashfree Webhook: Direct Order Payment Failed for ${orderId}`,
      );
    } else if (orderId.startsWith("WAIT_")) {
      await Payment.findOneAndUpdate(
        { cf_order_id: orderId, status: "ACTIVE" },
        { status: "FAILED" },
      );
      console.log(
        `Cashfree Webhook: Waiting Charge Payment Failed for ${orderId}`,
      );
    }
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
  if (![ORDER_STATUS.CREATED, ORDER_STATUS.SCHEDULED].includes(order.status)) {
    throw new Error("Order is not pending payment or is already paid");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Deduct from wallet
    wallet.balance -= amount;
    await wallet.save({ session });

    // Log transaction
    const wTx = await paymentsRepository.createWalletTransaction(
      {
        wallet_id: wallet._id,
        amount,
        type: "debit",
        description: `Payment for Order #${order._id}`,
        transaction_type: "order_payment",
        reference_id: order._id,
        status: PAYOUT_STATUS.COMPLETED,
      },
      session,
    );
    const transactionRecord = Array.isArray(wTx) ? wTx[0] : wTx;
    console.log("Wallet Transaction Created:", transactionRecord?._id);
    // Update order status
    order.status = ORDER_STATUS.CONFIRMED; // Paid/Active
    order.wallet_transaction_id =
      transactionRecord?._id || transactionRecord?.id;
    await order.save({ session });

    // Broadcast to DP if normal order
    const packageDetail = await PackageDetail.findById(
      order.package_id,
    ).session(session);
    if (packageDetail && order.order_type === "normal") {
      broadcastOrderToNearbyDPs(order, packageDetail).catch((err) =>
        console.error("[Broadcast] Wallet execution failed:", err),
      );
    }

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

  const isSuccessful = [
    PAYMENT_STATUS.PAID,
    PAYMENT_STATUS.SUCCESS,
    PAYMENT_STATUS.COMPLETED,
  ].includes(status.toUpperCase());

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
        status: isSuccessful ? PAYOUT_STATUS.COMPLETED : PAYMENT_STATUS.FAILED,
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

  const orderId = createCashfreeOrderId("WAL", user._id);

  const postData = {
    order_id: orderId,
    order_amount: amount,
    order_currency: "INR",
    customer_details: {
      customer_id: String(user._id),
      customer_email: user.email || "customer@countmee.in",
      customer_phone: getCashfreeCustomerPhone(user.phone),
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
        status: PAYOUT_STATUS.PENDING,
      });

      return {
        order_id: orderId,
        cf_order_id: orderId,
        payment_session_id: result.payment_session_id,
      };
    }
    throw new Error("Failed to retrieve payment_session_id from Cashfree API");
  } catch (error) {
    const cashfreeError = error.response ? error.response.data : error.message;
    console.error("Cashfree Initiate Error:", cashfreeError);
    throw new Error(
      getCashfreeErrorMessage(error, "Failed to create Cashfree order"),
    );
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
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const transaction = await WalletTransaction.findOneAndUpdate(
          { transaction_id: order_id, status: PAYOUT_STATUS.PENDING },
          { status: PAYOUT_STATUS.COMPLETED },
          { new: true, session },
        );

        if (transaction) {
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
        } else {
          await session.abortTransaction();
          session.endSession();
          return { already_processed: true };
        }
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
      }
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

export const initiateOrderPayment = async (user_id, order_id) => {
  const user = await User.findById(user_id);
  if (!user) throw new Error("User not found");

  const order = await Order.findById(order_id);
  if (!order) throw new Error("Order not found");
  if (![ORDER_STATUS.CREATED, ORDER_STATUS.SCHEDULED].includes(order.status)) {
    throw new Error("Order is not pending payment or is already paid");
  }

  const cf_order_id = createCashfreeOrderId("DIR", order_id);
  const amount = order.charges;

  const postData = {
    order_id: cf_order_id,
    order_amount: amount,
    order_currency: "INR",
    customer_details: {
      customer_id: String(user._id),
      customer_email: user.email || "customer@countmee.in",
      customer_phone: getCashfreeCustomerPhone(user.phone),
    },
    order_meta: {
      return_url: `https://countmee.in/payment-status?order_id=${order_id}&cf_order_id=${cf_order_id}`,
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
      const pay = await Payment.create({
        user_id,
        order_id,
        cf_order_id,
        amount,
        currency: "INR",
        status: PAYMENT_STATUS.ACTIVE,
        payment_mode: "Cashfree Direct",
      });
      order.payment_id = pay._id;
      await order.save();
      return {
        cf_order_id,
        payment_session_id: result.payment_session_id,
      };
    }
    throw new Error("Failed to retrieve payment_session_id from Cashfree API");
  } catch (error) {
    const cashfreeError = error.response ? error.response.data : error.message;
    console.error("Cashfree Initiate Error (Direct):", cashfreeError);
    throw new Error(
      getCashfreeErrorMessage(
        error,
        "Failed to create Cashfree order for direct payment",
      ),
    );
  }
};

export const verifyOrderPayment = async (cf_order_id, order_id) => {
  try {
    const response = await axios.get(`${CASHFREE_BASE_URL}/${cf_order_id}`, {
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
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        let payment = await Payment.findOneAndUpdate(
          { cf_order_id, status: PAYMENT_STATUS.ACTIVE },
          { status: PAYMENT_STATUS.SUCCESS },
          { new: true, session },
        );

        if (!payment) {
          payment = await Payment.findOne({
            cf_order_id,
            status: PAYMENT_STATUS.SUCCESS,
          }).session(session);
        }

        if (payment) {
          const order = await Order.findById(payment.order_id).session(session);
          if (
            order &&
            [ORDER_STATUS.CREATED, ORDER_STATUS.SCHEDULED].includes(
              order.status,
            )
          ) {
            order.status = ORDER_STATUS.CONFIRMED;
            order.payment_id = payment._id;
            await order.save({ session });

            // Broadcast to DP if normal order
            const packageDetail = await PackageDetail.findById(
              order.package_id,
            ).session(session);
            // if (packageDetail && order.order_type === "normal") {
            if (packageDetail) {
              console.log("broadCasting...");
              broadcastOrderToNearbyDPs(order, packageDetail).catch((err) =>
                console.error("[Broadcast] Verify execution failed:", err),
              );
            }

            await sendNotification({
              role: ROLES.USER,
              userId: order.user_id,
              title: "Payment Successful",
              message: `Direct payment of ₹${payment.amount} for Order #${order._id} completed successfully via Cashfree.`,
              session,
            });
          }

          await session.commitTransaction();
          session.endSession();
          return { success: true, message: "Payment verified successfully" };
        } else {
          await session.abortTransaction();
          session.endSession();
          return { already_processed: true };
        }
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
      }
    }
    throw new Error("Payment verification failed at Cashfree");
  } catch (error) {
    console.error("Cashfree Verify Error (Direct):", error);
    throw new Error("Payment verification failed");
  }
};

export const payWaitingChargeFromWallet = async (user_id, order_id) => {
  const { OrderWaitCharge } =
    await import("../orders/orderWaitCharge.model.js");
  const waitChargeDoc = await OrderWaitCharge.findOne({
    order_id,
    user_id,
    payment_status: "unpaid",
  });
  if (!waitChargeDoc) {
    throw new Error("No unpaid waiting charge found for this order");
  }

  const amount = waitChargeDoc.total_waiting_charge;
  if (amount <= 0) return true;

  const wallet = await paymentsRepository.findWalletByUserId(user_id);
  if (!wallet || wallet.balance < amount) {
    throw new Error("Insufficient wallet balance");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    wallet.balance -= amount;
    await wallet.save({ session });

    await paymentsRepository.createWalletTransaction(
      {
        wallet_id: wallet._id,
        amount,
        type: "debit",
        description: `Manual payment for waiting charges of Order #${order_id}`,
        transaction_type: "waiting_charge",
        reference_id: order_id,
        status: "completed",
      },
      session,
    );

    waitChargeDoc.payment_status = "paid";
    waitChargeDoc.payment_method = "wallet";
    waitChargeDoc.paid_at = new Date();
    await waitChargeDoc.save({ session });

    await sendNotification({
      role: ROLES.USER,
      userId: user_id,
      title: "Waiting Charge Paid",
      message: `Waiting charge of ₹${amount} for Order #${order_id} was successfully paid from your wallet.`,
      orderId: order_id,
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

export const initiateWaitingChargePayment = async (user_id, order_id) => {
  const { OrderWaitCharge } =
    await import("../orders/orderWaitCharge.model.js");
  const user = await User.findById(user_id);
  if (!user) throw new Error("User not found");

  const waitChargeDoc = await OrderWaitCharge.findOne({
    order_id,
    user_id,
    payment_status: "unpaid",
  });
  if (!waitChargeDoc) {
    throw new Error("No unpaid waiting charge found for this order");
  }

  const amount = waitChargeDoc.total_waiting_charge;
  if (amount <= 0) throw new Error("Waiting charge amount is zero");

  const cf_order_id = createCashfreeOrderId("WAIT", order_id);

  const postData = {
    order_id: cf_order_id,
    order_amount: amount,
    order_currency: "INR",
    customer_details: {
      customer_id: String(user._id),
      customer_email: user.email || "customer@countmee.in",
      customer_phone: getCashfreeCustomerPhone(user.phone),
    },
    order_meta: {
      return_url: `https://countmee.in/payment-status?order_id=${order_id}&cf_order_id=${cf_order_id}&payment_for=waiting_charge`,
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
      await Payment.create({
        user_id,
        order_id,
        cf_order_id,
        amount,
        currency: "INR",
        status: "ACTIVE",
        payment_mode: "Cashfree Waiting Charge",
      });

      return {
        cf_order_id,
        payment_session_id: result.payment_session_id,
      };
    }
    throw new Error("Failed to retrieve payment_session_id from Cashfree API");
  } catch (error) {
    const cashfreeError = error.response ? error.response.data : error.message;
    console.error("Cashfree Initiate Error (Waiting Charge):", cashfreeError);
    throw new Error(
      getCashfreeErrorMessage(
        error,
        "Failed to create Cashfree order for waiting charge payment",
      ),
    );
  }
};

export const verifyWaitingChargePayment = async (cf_order_id, order_id) => {
  const { OrderWaitCharge } =
    await import("../orders/orderWaitCharge.model.js");
  try {
    const response = await axios.get(`${CASHFREE_BASE_URL}/${cf_order_id}`, {
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
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const payment = await Payment.findOneAndUpdate(
          { cf_order_id, status: "ACTIVE" },
          { status: "SUCCESS" },
          { new: true, session },
        );

        if (payment) {
          const waitChargeDoc = await OrderWaitCharge.findOne({
            order_id,
          }).session(session);
          if (waitChargeDoc && waitChargeDoc.payment_status === "unpaid") {
            waitChargeDoc.payment_status = "paid";
            waitChargeDoc.payment_method = "cashfree";
            waitChargeDoc.paid_at = new Date();
            await waitChargeDoc.save({ session });

            await sendNotification({
              role: ROLES.USER,
              userId: waitChargeDoc.user_id,
              title: "Waiting Charge Paid",
              message: `Waiting charge of ₹${payment.amount} for Order #${order_id} completed successfully via Cashfree.`,
              session,
            });
          }
          await session.commitTransaction();
          session.endSession();
          return {
            success: true,
            message: "Waiting charge payment verified successfully",
          };
        } else {
          await session.abortTransaction();
          session.endSession();
          return { already_processed: true };
        }
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
      }
    }
    throw new Error("Waiting charge payment verification failed at Cashfree");
  } catch (error) {
    console.error("Cashfree Verify Error (Waiting Charge):", error);
    throw new Error("Waiting charge payment verification failed");
  }
};
