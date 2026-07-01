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
  FAILED: "failed"
};

export const ACTIVE_ORDER_STATUSES = [
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.PACKED,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.OUT_FOR_DELIVERY
];

export const ORDER_REQUEST_STATUS = {
  PENDING: null,
  REJECTED: 0,
  ACCEPTED: 1
};

export const ORDER_REQUEST_COMPLETE_STATUS = {
  PENDING: null,
  COMPLETED: 1
};
