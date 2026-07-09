const EXPIRY_MONTHS = 4;
const LATE_REVENUE_MONTHS = 1;

export const getExpiryCutoffDate = () => {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - EXPIRY_MONTHS);
  return cutoff;
};

export const getLateRevenueCutoffDate = () => {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - LATE_REVENUE_MONTHS);
  return cutoff;
};

export const wasPaidLate = (waitCharge) => {
  if (waitCharge.payment_status !== "paid" || !waitCharge.paid_at) return false;
  const ownCutoff = new Date(waitCharge.created_at);
  ownCutoff.setMonth(ownCutoff.getMonth() + EXPIRY_MONTHS);
  return waitCharge.paid_at > ownCutoff;
};
