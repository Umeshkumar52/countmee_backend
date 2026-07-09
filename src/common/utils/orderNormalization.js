export const normalizeOrder = (o) => {
  if (!o) return null;
  const orderObj = o.toObject ? o.toObject() : o;

  // Map numerical or string status to standard lowercase status
  let statusStr = "pending";
  if (typeof orderObj.status === "number") {
    const sm = {
      0: "pending",
      1: "assigned",
      2: "cancelled",
      3: "intransit",
      4: "delivered",
    };
    statusStr = sm[orderObj.status] || "pending";
  } else if (typeof orderObj.status === "string") {
    statusStr = orderObj.status.toLowerCase();
  }

  let paymentStatus = "pending";
  if (orderObj.payment_status) {
    paymentStatus = orderObj.payment_status;
  } else if (orderObj.wallet_transaction_id || orderObj.payment_id) {
    paymentStatus = "paid";
  } else if (orderObj.payment_settled) {
    paymentStatus = "settled";
  }

  let paymentMethod = "N/A";
  if (orderObj.wallet_transaction_id) {
    paymentMethod = "Wallet";
  } else if (orderObj.payment_id) {
    paymentMethod = "Payment Gateway";
  }

  return {
    id: orderObj._id,
    orderNumber:
      orderObj?.orderNumber ||
      `order${orderObj?._id?.toString()?.slice(0, 10)}` ||
      `order_${orderObj?.order_id?.toString()?.slice(0, 10)}`,
    order_number:
      orderObj.orderNumber || orderObj.order_id || orderObj._id.toString(),
    customer_name: orderObj.user_id?.name || orderObj.sender_name || "N/A",
    customer_phone: orderObj.user_id?.phone || orderObj.sender_phone || "N/A",
    pickup_address:
      orderObj.pickup_address || orderObj.pickup_location || "N/A",
    delivery_address:
      orderObj.delivery_address ||
      orderObj.delivery_location ||
      orderObj.drop_location ||
      "N/A",
    pdc_name: orderObj.pdc_id?.shop_name || orderObj.pdc_name || "Direct",
    dp_name:
      orderObj.pickup_dp_id?.name ||
      orderObj.delivery_dp_id?.name ||
      orderObj.dp_name ||
      "",
    amount: orderObj.charges || orderObj.amount || 0,
    status: statusStr,
    drop_otp: orderObj.drop_otp || "",
    items_count: orderObj.items_count || 1,
    payment_status: paymentStatus,
    payment_method: paymentMethod,
    payment_history:
      orderObj.wallet_transaction_id || orderObj.payment_id || null,
    created_at: orderObj.createdAt
      ? new Date(orderObj.createdAt).toISOString().split("T")[0]
      : orderObj.created_at || "N/A",
    packageDetail: orderObj.package_id || null,
    raw: orderObj, // Preserve raw document nested fields to prevent any downstream breakages
  };
};
