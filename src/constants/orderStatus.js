export const ORDER_STATUS = {
  CREATED: "created",
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  PACKED: "packed",
  SHIPPED: "shipped",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  RETURNED: "returned",
  REFUNDED: "refunded",
  FAILED: "failed",
  SCHEDULED: "scheduled",
};

export const ACTIVE_ORDER_STATUSES = [
  ORDER_STATUS.CREATED,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.PACKED,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.OUT_FOR_DELIVERY,
];

export const ORDER_REQUEST_STATUS = {
  PENDING: "pending",
  REJECTED: "rejected",
  ACCEPTED: "accepted",
};

export const ORDER_REQUEST_COMPLETE_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
};

export const USER_ACTION_STATUS = {
  CANCELLED: "cancelled",
};

export const PAYOUT_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
};

export const BROADCAST_STATUS = {
  PENDING: "pending",
  BROADCASTING: "broadcasting",
  ACCEPTED: "accepted",
  COMPLETED: "completed",
  ACTIVE: "active",
};

export const DOCUMENT_APPROVAL_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

export const PAYMENT_STATUS = {
  ACTIVE: "active",
  COMPLETED: "completed",
  PAID: "paid",
  SUCCESS: "success",
  FAILED: "failed",
};
