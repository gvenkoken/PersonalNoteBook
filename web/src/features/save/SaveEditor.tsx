import { useState, useSyncExternalStore } from 'react'
import { NamingDialog } from '../naming/NamingDialog'
import type { EditorTabStore } from '../../state/editorTabs'
import { useSave } from './useSave'

/** Scoped integration surface for the manual save and naming workflow. */
export function SaveEditor({ store }: { store: EditorTabStore }) {
  const tabs = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [selected, setSelected] = useState<string>()
  const active = tabs.find(tab => tab.key === selected) ?? tabs[0]
  const save = useSave(store, active?.key)
  return <main aria-label="Not düzenleyici">
    <nav aria-label="Dosya">
      <button onClick={() => setSelected(store.create())}>Yeni</button>
      <button disabled={!active || save.busy} onClick={save.save}>Kaydet</button>
      <button disabled={!active || save.busy} onClick={() => save.rename()}>Adını değiştir</button>
    </nav>
    <div role="tablist" aria-label="Açık notlar">
      {tabs.map(tab => <button key={tab.key} role="tab" aria-selected={active?.key === tab.key}
        onClick={() => setSelected(tab.key)} onDoubleClick={() => save.rename(tab.key)}>
        {tab.title}{tab.dirty && <span aria-label="Kaydedilmemiş değişiklikler"> *</span>}
      </button>)}
    </div>
    {active && <textarea aria-label="Not içeriği" value={active.content}
      onChange={event => store.setContent(active.key, event.target.value)} />}
    <footer role="status" aria-label="Editör durumu">{save.status}</footer>
    {save.namingTab && <NamingDialog key={save.namingTab.key} initialTitle={save.namingTab.title}
      busy={save.busy} error={save.nameError} onSave={save.submitName} onCancel={save.cancelNaming} />}
  </main>
}
