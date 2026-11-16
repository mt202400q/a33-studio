import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label
} from '@cherrystudio/ui'
import { toast } from '@renderer/services/toast'
import { a33AccountErrorCodes } from '@shared/ipc/errors/a33Account'
import { IpcError } from '@shared/ipc/errors/IpcError'
import type { A33LoginResult } from '@shared/ipc/schemas/a33Account'

const ERROR_KEYS: Record<string, string> = {
  [a33AccountErrorCodes.INVALID_CREDENTIALS]: 'a33.home.login.error.invalid_credentials',
  [a33AccountErrorCodes.INVALID_2FA_CODE]: 'a33.home.login.error.invalid_2fa_code',
  [a33AccountErrorCodes.INACTIVE]: 'a33.home.login.error.inactive',
  [a33AccountErrorCodes.RATE_LIMITED]: 'a33.home.login.error.rate_limited'
}

interface A33LoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  login: (email: string, password: string) => Promise<A33LoginResult>
  loginWith2fa: (tempToken: string, code: string) => Promise<A33LoginResult>
}

export function A33LoginDialog({ open, onOpenChange, login, loginWith2fa }: A33LoginDialogProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [twoFactor, setTwoFactor] = useState<{ tempToken: string; maskedEmail: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = (next: boolean) => {
    if (next) return onOpenChange(true)
    setPassword('')
    setCode('')
    setTwoFactor(null)
    setError(null)
    onOpenChange(false)
  }

  const canSubmit = twoFactor ? /^\d{6}$/.test(code) : email.trim() !== '' && password !== ''

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const result = twoFactor ? await loginWith2fa(twoFactor.tempToken, code) : await login(email, password)
      if (result.status === 'requires_2fa') {
        setTwoFactor({ tempToken: result.tempToken, maskedEmail: result.maskedEmail })
        return
      }
      toast.success(t('a33.home.login.success'))
      close(false)
    } catch (cause) {
      const key = cause instanceof IpcError ? ERROR_KEYS[cause.code] : undefined
      setError(key ? t(key) : t('a33.home.login.error.generic', { message: (cause as Error).message }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{twoFactor ? t('a33.home.login.two_factor_title') : t('a33.home.login.title')}</DialogTitle>
          <DialogDescription>
            {twoFactor
              ? t('a33.home.login.two_factor_description', { email: twoFactor.maskedEmail })
              : t('a33.home.login.description')}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}>
          {twoFactor ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a33-login-code">{t('a33.home.login.code')}</Label>
              <Input
                id="a33-login-code"
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="a33-login-email">{t('a33.home.login.email')}</Label>
                <Input
                  id="a33-login-email"
                  autoFocus
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="a33-login-password">{t('a33.home.login.password')}</Label>
                <Input
                  id="a33-login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="m-0 text-error text-xs">
              {error}
            </p>
          )}
          {/* Hidden submit keeps Enter-to-submit working; the visible action lives in the footer. */}
          <button type="submit" hidden />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" loading={submitting} disabled={!canSubmit} onClick={() => void submit()}>
            {twoFactor ? t('a33.home.login.verify') : t('a33.home.login.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
