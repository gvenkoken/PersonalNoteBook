import { useRef, useState, useSyncExternalStore } from 'react'
import { countChars, normalizeNewlines, splitLines } from '../conversion'
import { EditorTabStore } from '../state/editorTabs'
import '../styles/editor.css'

export function Editor({ store, loading = false, updatedAt = {} }: {
  store: EditorTabStore; loading?: boolean; updatedAt?: Readonly<Record<string, string>>
}) {
  const tabs = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const active = tabs.find(tab => tab.key === activeKey) ?? tabs[0]
  const input = useRef<HTMLTextAreaElement>(null)
  const gutter = useRef<HTMLOListElement>(null)
  function create() { setActiveKey(store.create()) }
  function cursor(element: HTMLTextAreaElement) {
    if (!active) return
    const lines = splitLines(element.value.slice(0, element.selectionStart))
    store.setCursor(active.key, lines.length, countChars(lines[lines.length - 1]) + 1)
  }
  return <main className="workspace" aria-label="Not düzenleyici" aria-busy={loading}>
    <header><h1>NotDefteri</h1></header>
    <nav className="menus" aria-label="Ana menü">
      <details><summary>Dosya</summary><div className="menu-items"><button onClick={create} disabled={loading}>Yeni</button><button disabled>Kaydet</button><button disabled>Sil</button></div></details>
      <details><summary>Düzen</summary><div className="menu-items">
        {([['Geri Al', 'undo'], ['Yinele', 'redo'], ['Kes', 'cut'], ['Kopyala', 'copy'], ['Yapıştır', 'paste'], ['Tümünü Seç', 'selectAll']] as const).map(([label, command]) =>
          <button key={command} disabled={!active} onClick={() => {
            input.current?.focus()
            if (command === 'selectAll') input.current?.select()
            else document.execCommand(command)
          }}>{label}</button>)}
      </div></details>
      <details><summary>Görünüm</summary><div className="menu-items">Satır numaraları açık</div></details>
      <details><summary>Dönüştür</summary><div className="menu-items"><button disabled>JSON</button><button disabled>HTML</button></div></details>
    </nav>
    <div className="toolbar" role="toolbar" aria-label="Not araçları">
      <button onClick={create} disabled={loading}><span aria-hidden="true">＋</span> Yeni</button>
      <button disabled><span aria-hidden="true">▣</span> Kaydet</button>
      <button disabled><span aria-hidden="true">×</span> Sil</button>
    </div>
    <div className="tabs" role="tablist" aria-label="Açık notlar">
      {tabs.map((tab, index) => <button key={tab.key} id={`tab-${tab.key}`} role="tab"
        aria-selected={active?.key === tab.key} aria-controls="note-panel" tabIndex={active?.key === tab.key ? 0 : -1}
        title={`${tab.title}\nGüncelleme: ${tab.noteId ? updatedAt[tab.noteId] ?? 'Bilinmiyor' : 'Henüz kaydedilmedi'}${tab.dirty ? '\nKaydedilmemiş değişiklikler' : ''}`}
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
        }}>{tab.title}{tab.dirty && <span aria-label="Kaydedilmemiş değişiklikler"> *</span>}</button>)}
    </div>
    {loading ? <div className="empty" role="status">Notlar yükleniyor…</div> : active ?
      <section className="editor" id="note-panel" role="tabpanel" aria-labelledby={`tab-${active.key}`}>
        <ol className="line-numbers" aria-label="Satır numaraları" ref={gutter}>
          {splitLines(active.content).map((_, index) => <li key={index}>{index + 1}</li>)}
        </ol>
        <textarea key={active.key} ref={input} aria-label="Not içeriği" spellCheck={false} wrap="off"
          value={active.content} onChange={event => {
            store.setContent(active.key, normalizeNewlines(event.currentTarget.value))
            cursor(event.currentTarget)
          }} onSelect={event => cursor(event.currentTarget)}
          onScroll={event => { if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop }} />
      </section> : <div className="empty"><h2>Hiç açık not yok</h2><p>Başlamak için Yeni düğmesini kullanın.</p></div>}
    <footer className="statusbar" role="status" aria-label="Editör durumu">
      <span>Satır {active?.cursor.line ?? 1}, Sütun {active?.cursor.column ?? 1}</span>
      <span>{countChars(active?.content ?? '')} karakter</span>
    </footer>
  </main>
}
