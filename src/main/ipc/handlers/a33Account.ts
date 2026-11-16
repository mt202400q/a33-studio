import { getAccountStatus, login, loginWith2fa, logout, provisionKeys } from '@main/services/a33Account'
import type { a33AccountRequestSchemas } from '@shared/ipc/schemas/a33Account'
import type { IpcHandlersFor } from '@shared/ipc/types'

export const a33AccountHandlers: IpcHandlersFor<typeof a33AccountRequestSchemas> = {
  'a33.account.status': () => getAccountStatus(),
  'a33.account.login': (input) => login(input),
  'a33.account.login_2fa': (input) => loginWith2fa(input),
  'a33.account.provision_keys': (input) => provisionKeys(input),
  'a33.account.logout': () => logout()
}
