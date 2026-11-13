// Which audit events appear as team activity in the notification bell, and how loud they are.
// Shared by the server (which filters) and the bell (which colours them).

/** "alert": a correction or removal the owner should notice. "info": normal daily work. */
export const ACTIVITY_EVENTS = {
  "payment.void": "alert",
  "cashbook.void": "alert",
  "bike.seller_payment_void": "alert",
  "bike.sale_cancel": "alert",
  "plan.discount": "alert",
  "plan.schedule_update": "alert",
  "document.remove": "alert",
  "document.erase": "alert",
  "payment.record": "info",
  "plan.create": "info",
  "customer.create": "info",
  "bike.purchase": "info",
  "bike.sell_cash": "info",
  "bike.sell_installment": "info",
  "bike.seller_payment": "info",
  "cashbook.create": "info",
  "document.upload": "info",
  "document.restore": "info",
};

export const ACTIVITY_ACTIONS = Object.keys(ACTIVITY_EVENTS);

/** Link for an audit event's record. */
export function activityHref(e) {
  if (e.entityType === "customer" && e.entityId) return `/customers/${e.entityId}`;
  if (e.entityType === "installmentPlan" && e.entityId) return `/plans/${e.entityId}`;
  if (e.entityType === "bike" && e.entityId) return `/bikes/${e.entityId}`;
  if (e.entityType === "financialTransaction") return "/cashbook";
  return null;
}
