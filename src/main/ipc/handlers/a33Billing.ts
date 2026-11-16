import {
  cancelOrder,
  createOrder,
  getCheckout,
  getOrderStatus,
  listOrders,
  listUsage,
  redeem,
  usageSummary
} from '@main/services/a33Billing'
import type { a33BillingRequestSchemas } from '@shared/ipc/schemas/a33Billing'
import type { IpcHandlersFor } from '@shared/ipc/types'

export const a33BillingHandlers: IpcHandlersFor<typeof a33BillingRequestSchemas> = {
  'a33.billing.usage_list': (input) => listUsage(input),
  'a33.billing.usage_summary': (input) => usageSummary(input),
  'a33.billing.checkout': () => getCheckout(),
  'a33.billing.create_order': (input) => createOrder(input),
  'a33.billing.order_status': (input) => getOrderStatus(input),
  'a33.billing.cancel_order': (input) => cancelOrder(input),
  'a33.billing.orders': (input) => listOrders(input),
  'a33.billing.redeem': (input) => redeem(input)
}
