import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { countChars, normalizeNewlines, splitLines } from '../conversion'
import { EditorTabStore } from '../state/editorTabs'
import '../styles/editor.css'
import { useSave } from '../features/save/useSave'
import { NamingDialog } from '../features/naming/NamingDialog'
import { OpenNoteDialog } from '../features/open-note/OpenNoteDialog'
import { DeleteNoteDialog } from '../features/delete-note/DeleteNoteEditor'
import { ModalScope } from './ModalScope'
import { Preview } from './Preview'
import type { ExportFormat } from '../features/export-preview/ExportPreviewPanel'
import './integration.css'

// Scoped feature harnesses keep their own controls; App opts into the shared workflows.
export function Editor({ store, loading = false, updatedAt = {}, integrated = false }: {
  store: EditorTabStore; loading?: boolean; updatedAt?: Readonly<Record<string, string>>; integrated?: boolean
}) {
  const tabs = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const active = tabs.find(tab => tab.key === activeKey) ?? tabs[0]
  const [dialog, setDialog] = useState<'open' | 'delete' | 'close' | null>(null)
  const [closingKey, setClosingKey] = useState<string | null>(null)
  const [preview, setPreview] = useState<ExportFormat | null>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const previewTrigger = useRef<HTMLElement | null>(null)
  // Menu bar: a chosen command closes its menu, only one menu is open at a time, and a click outside or Escape closes it.
  const menus = useRef<HTMLElement | null>(null)
  const closeMenus = (except?: Element | null) =>
    menus.current?.querySelectorAll('details[open]').forEach(menu => { if (menu !== except) menu.removeAttribute('open') })
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!menus.current?.contains(event.target as Node)) closeMenus() }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeMenus() }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [])
  const save = useSave(store, !integrated || loading || (dialog && dialog !== 'close') ? undefined : active?.key)
  const modal = Boolean(dialog || save.namingTab)
  function cancel() { setDialog(null); setClosingKey(null); save.cancelNaming() }
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (store.getSnapshot().some(tab => tab.dirty)) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    if (!integrated) return
    window.addEventListener('beforeunload', unload)
    return () => window.removeEventListener('beforeunload', unload)
  }, [store, integrated])
  useEffect(() => {
    if (!closingKey || save.busy || save.namingTab) return
    const tab = tabs.find(item => item.key === closingKey)
    if (tab && !tab.dirty) { store.close(closingKey); setClosingKey(null) }
  }, [tabs, closingKey, save.busy, save.namingTab, store])
  const input = useRef<HTMLTextAreaElement>(null)
  const gutter = useRef<HTMLOListElement>(null)
  function create() { setActiveKey(store.create()) }
  function cursor(element: HTMLTextAreaElement) {
    if (!active) return
    const lines = splitLines(element.value.slice(0, element.selectionStart))
    store.setCursor(active.key, lines.length, countChars(lines[lines.length - 1]) + 1)
  }
  return <div className={integrated ? `integrated-editor export-preview-layout${preview ? ' export-preview-open' : ''}` : undefined}>
    <div className={integrated ? 'export-preview-editor' : undefined}>
    <main className="workspace" aria-label="Not düzenleyici" aria-busy={loading}
    onKeyDownCapture={event => {
      if (!modal && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') trigger.current = event.target as HTMLElement
    }}>
    <header><h1>NotDefteri</h1></header>
    <nav className="menus" aria-label="Ana menü" ref={menus} onClick={event => {
      const target = event.target as Element
      if (target.closest('.menu-items button')) closeMenus()
      else if (target.closest('summary')) closeMenus(target.closest('details'))
    }}>
      <details><summary>Dosya</summary><div className="menu-items">
        <button onClick={create} disabled={loading || modal}>Yeni</button>
        {integrated && <button disabled={loading || modal} onClick={event => { trigger.current = event.currentTarget; setDialog('open') }}>Aç</button>}
        <button disabled={!integrated || !active || loading || modal || save.busy} onClick={event => { if (integrated) { trigger.current = event.currentTarget; save.save() } }}>Kaydet</button>
        {integrated && <button disabled={!active || loading || modal || save.busy} onClick={event => { trigger.current = event.currentTarget; save.rename() }}>Ad Değiştir</button>}
        <button disabled={!integrated || !active || loading || modal || save.busy} onClick={event => { if (integrated) { trigger.current = event.currentTarget; setDialog('delete') } }}>Sil</button>
      </div></details>
      <details><summary>Düzen</summary><div className="menu-items">
        {([['Geri Al', 'undo'], ['Yinele', 'redo'], ['Kes', 'cut'], ['Kopyala', 'copy'], ['Yapıştır', 'paste'], ['Tümünü Seç', 'selectAll']] as const).map(([label, command]) =>
          <button key={command} disabled={!active || modal || loading} onClick={() => {
            input.current?.focus()
            if (command === 'selectAll') input.current?.select()
            else document.execCommand(command)
          }}>{label}</button>)}
      </div></details>
      <details><summary>Görünüm</summary><div className="menu-items">Satır numaraları açık</div></details>
      <details><summary>Dönüştür</summary><div className="menu-items">{(['json', 'html'] as const).map(format =>
        <button key={format} disabled={!integrated || loading || modal} onClick={event => { if (integrated) { previewTrigger.current = event.currentTarget; setPreview(format) } }}>{format.toUpperCase()}</button>)}</div></details>
    </nav>
    <div className="toolbar" role="toolbar" aria-label="Not araçları">
      <button onClick={create} disabled={loading || modal}><span aria-hidden="true">＋</span> Yeni</button>
      <button disabled={!integrated || !active || loading || modal || save.busy} onClick={event => { if (integrated) { trigger.current = event.currentTarget; save.save() } }}><span aria-hidden="true">▣</span> Kaydet</button>
      <button disabled={!integrated || !active || loading || modal || save.busy} onClick={event => { if (integrated) { trigger.current = event.currentTarget; setDialog('delete') } }}><span aria-hidden="true">×</span> Sil</button>
    </div>
    <div className="tabs" role="tablist" aria-label="Açık notlar">
      {tabs.map((tab, index) => <span key={tab.key}><button id={`tab-${tab.key}`} role="tab"
        aria-selected={active?.key === tab.key} aria-controls="note-panel" tabIndex={active?.key === tab.key ? 0 : -1}
        title={`${tab.title}\nGüncelleme: ${tab.noteId ? updatedAt[tab.noteId] ?? 'Bilinmiyor' : 'Henüz kaydedilmedi'}${tab.dirty ? '\nKaydedilmemiş değişiklikler' : ''}`}
        onDoubleClick={event => { if (integrated) { trigger.current = event.currentTarget; setActiveKey(tab.key); save.rename(tab.key) } }}
        disabled={modal}
        onClick={() => setActiveKey(tab.key)} onKeyDown={event => {
          let next = index
          if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
          else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length
          else if (event.key === 'Home') next = 0
          else if (event.key === 'End') next = tabs.length - 1
          else return
          event.preventDefault()
          setActiveKey(tabs[next].key)
          document.getElementById(`tab-${tabs[next].key}`)?.focus()
        }}>{tab.title}{tab.dirty && <span aria-label="Kaydedilmemiş değişiklikler"> *</span>}</button>
        {integrated && <button aria-label={`${tab.title} sekmesini kapat`} disabled={loading || modal || save.busy} onClick={event => {
          trigger.current = event.currentTarget
          setActiveKey(tab.key)
          if (tab.dirty) setDialog('close')
          else store.close(tab.key)
        }}>×</button>}</span>)}
    </div>
    {loading ? <div className="empty" role="status">Notlar yükleniyor…</div> : active ?
      <section className="editor" id="note-panel" role="tabpanel" aria-labelledby={`tab-${active.key}`}>
        <ol className="line-numbers" aria-label="Satır numaraları" ref={gutter}>
          {splitLines(active.content).map((_, index) => <li key={index}>{index + 1}</li>)}
        </ol>
        <textarea key={active.key} ref={input} aria-label="Not içeriği" spellCheck={false} wrap="off" readOnly={modal}
          value={active.content} onChange={event => {
            store.setContent(active.key, normalizeNewlines(event.currentTarget.value))
            cursor(event.currentTarget)
          }} onSelect={event => cursor(event.currentTarget)}
          onScroll={event => { if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop }} />
      </section> : <div className="empty"><h2>Hiç açık not yok</h2><p>Başlamak için Yeni düğmesini kullanın.</p></div>}
    <footer className="statusbar" role="status" aria-label="Editör durumu">
      <span>Satır {active?.cursor.line ?? 1}, Sütun {active?.cursor.column ?? 1}</span>
      <span>{countChars(active?.content ?? '')} karakter</span>
      <span>{save.status}</span>
    </footer>
    {modal && <ModalScope trigger={trigger} onCancel={cancel} busy={save.busy}>
      {save.namingTab ? <NamingDialog key={save.namingTab.key} initialTitle={save.namingTab.title}
        busy={save.busy} error={save.nameError} onSave={save.submitName} onCancel={cancel} />
        : dialog === 'open' ? <OpenNoteDialog store={store} onCancel={cancel} onOpened={key => { setActiveKey(key); setDialog(null) }} />
        : dialog === 'delete' && active ? <DeleteNoteDialog store={store} tab={active} onClose={cancel} />
        : dialog === 'close' && active ? <div role="dialog" aria-modal="true" aria-labelledby="close-heading">
          <h2 id="close-heading">{active.title} kapatılsın mı?</h2>
          <p>Bu notta kaydedilmemiş değişiklikler var. Kaydetme seçilirse değişiklikler kaybolacak.</p>
          <button onClick={() => { setClosingKey(active.key); setDialog(null); save.save() }}>Kaydet</button>
          <button onClick={() => { store.close(active.key); cancel() }}>Kaydetme</button>
          <button autoFocus onClick={cancel}>Vazgeç</button>
        </div> : null}
    </ModalScope>}
  </main></div>
    {preview && <Preview tab={active} format={preview} onFormatChange={setPreview} onClose={() => {
      setPreview(null); previewTrigger.current?.focus()
    }} />}
  </div>
}
