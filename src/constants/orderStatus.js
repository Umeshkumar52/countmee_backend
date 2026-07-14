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
  PENDING: "Pending",
  REJECTED: "Rejected",
  ACCEPTED: "Accepted",
};

export const ORDER_REQUEST_COMPLETE_STATUS = {
  PENDING: "Pending",
  COMPLETED: "Completed",
};

export const USER_ACTION_STATUS = {
  CANCELLED: "Cancelled",
};

export const PAYOUT_STATUS = {
  PENDING: "Pending",
  COMPLETED: "Completed",
};
