import { useNavigate } from '@tanstack/react-router'
import { Copy, FolderCog, FolderOpen, PencilLine, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Dialog, DialogContent, DialogTitle, EmptyState, PageHeader, Scrollbar, Switch } from '@cherrystudio/ui'
import { usePreference } from '@data/hooks/usePreference'
import { ipcApi } from '@renderer/ipc'
import { toast } from '@renderer/services/toast'
import { A33_IMAGE_ASSISTANT_ID } from '@shared/data/presets/a33ImageAssistant'
import type { ArchivedImageItem, ArchivedImageListing } from '@shared/ipc/schemas/a33ImageArchive'

/** A33 build: browses generated images archived under Documents/A33 Studio/图/<date>/. */
export default function GalleryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [listing, setListing] = useState<ArchivedImageListing | null>(null)
  const [selected, setSelected] = useState<ArchivedImageItem | null>(null)
  const [archiveEnabled, setArchiveEnabled] = usePreference('feature.paintings.archive.enabled')
  const [archiveDir, setArchiveDir] = usePreference('feature.paintings.archive.dir')

  const refresh = useCallback(async () => {
    try {
      setListing(await ipcApi.request('a33.image_archive.list'))
    } catch {
      toast.error(t('a33.gallery.load_failed'))
    }
  }, [t])

  useEffect(() => {
    void refresh()
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh, archiveDir])

  const changeFolder = async () => {
    const dir = await window.api.file.selectFolder({ defaultPath: listing?.root })
    if (dir) await setArchiveDir(dir)
  }

  const copy = async (image: ArchivedImageItem) => {
    const ok = await ipcApi.request('a33.image_archive.copy', { path: image.path })
    if (ok) toast.success(t('a33.gallery.copied'))
    else toast.error(t('a33.gallery.action_failed'))
    return ok
  }

  const continueEditing = async (image: ArchivedImageItem) => {
    if (!(await copy(image))) return
    setSelected(null)
    toast.info(t('a33.gallery.continue_hint'))
    void navigate({ to: '/app/chat', search: { assistantId: A33_IMAGE_ASSISTANT_ID } })
  }

  const trash = async (image: ArchivedImageItem) => {
    try {
      await ipcApi.request('a33.image_archive.trash', { path: image.path })
      setSelected(null)
      toast.success(t('a33.gallery.deleted'))
      void refresh()
    } catch {
      toast.error(t('a33.gallery.action_failed'))
    }
  }

  const days = listing?.days ?? []

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <PageHeader
        title={t('a33.gallery.title')}
        action={
          <div className="flex items-center gap-1">
            <label className="mr-2 flex items-center gap-1.5 text-muted-foreground text-xs">
              <Switch
                size="sm"
                checked={archiveEnabled}
                onCheckedChange={(checked) => void setArchiveEnabled(checked)}
              />
              {t('a33.gallery.auto_save')}
            </label>
            <Button size="sm" variant="ghost" onClick={() => void changeFolder()}>
              <FolderCog size={14} />
              {t('a33.gallery.change_folder')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void refresh()}>
              <RefreshCw size={14} />
              {t('a33.gallery.refresh')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void ipcApi.request('a33.image_archive.open_root')}>
              <FolderOpen size={14} />
              {t('a33.gallery.open_folder')}
            </Button>
          </div>
        }
      />
      {listing && days.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState title={t('a33.gallery.empty')} description={listing.root} />
        </div>
      ) : (
        <Scrollbar className="min-h-0 flex-1">
          <div className="flex flex-col gap-6 px-5 pb-6">
            {days.map((day) => (
              <section key={day.date} className="flex flex-col gap-2">
                <h3 className="m-0 font-medium text-muted-foreground text-xs">
                  {day.date} · {t('a33.gallery.count', { count: day.images.length })}
                </h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
                  {day.images.map((image) => (
                    <button
                      key={image.path}
                      type="button"
                      title={image.name}
                      className="aspect-square cursor-pointer overflow-hidden rounded-lg border border-border bg-muted p-0 hover:ring-2 hover:ring-primary"
                      onClick={() => setSelected(image)}>
                      <img src={image.url} alt={image.name} loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Scrollbar>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-[860px]">
          {selected && (
            <div className="flex flex-col gap-3">
              <DialogTitle className="truncate text-sm">{selected.name}</DialogTitle>
              <img
                src={selected.url}
                alt={selected.name}
                className="max-h-[65vh] w-full rounded-md bg-muted object-contain"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => void trash(selected)}>
                  <Trash2 size={14} />
                  {t('a33.gallery.delete')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void ipcApi.request('a33.image_archive.reveal', { path: selected.path })}>
                  <FolderOpen size={14} />
                  {t('a33.gallery.reveal')}
                </Button>
                <Button variant="outline" onClick={() => void copy(selected)}>
                  <Copy size={14} />
                  {t('a33.gallery.copy')}
                </Button>
                <Button onClick={() => void continueEditing(selected)}>
                  <PencilLine size={14} />
                  {t('a33.gallery.continue_edit')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
