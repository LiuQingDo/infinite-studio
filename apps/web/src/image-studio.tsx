import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ArrowRight, ArrowUp, AtSign, ChevronRight, Copy, ImagePlus, Images, LoaderCircle, MessageSquare, Plus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import type { Template } from './templates';
import { StudioSelect } from './studio-select';
import { apiSettings, generateImage } from './image-api';
import { DEFAULT_IMAGE_MODELS } from './image-models';

type Reference = { id: string; name: string; data: string };
type Settings = { model: string; ratio: string; resolution: string; count: number };
type Turn = { id: string; prompt: string; references: Reference[]; settings: Settings; images: Reference[]; state: 'running' | 'complete' | 'interrupted' | 'failed'; error?: string; created: number };
type Conversation = { id: string; title: string; turns: Turn[]; updated: number };
type Props = { visible: boolean; onSettings: () => void; prompt: string; setPrompt: Dispatch<SetStateAction<string>>; ratio: string; setRatio: Dispatch<SetStateAction<string>>; selected: Template | null; values: Record<string, string>; updateField: (key: string, value: string) => void; clearTemplate: () => void; onBrowse: () => void };
const uid = () => crypto.randomUUID();
const emptyConversation = (): Conversation => ({ id: uid(), title: '新的创作', turns: [], updated: Date.now() });

// IndexedDB keeps reference images out of localStorage's small string quota.
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('infinite-image-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function readConversations(): Promise<Conversation[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workspace', 'readonly');
    const req = tx.objectStore('workspace').get('conversations');
    req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
async function saveConversations(conversations: Conversation[]): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workspace', 'readwrite');
    tx.objectStore('workspace').put(conversations, 'conversations');
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
export function ImageStudio({ visible, onSettings, prompt, setPrompt, ratio, setRatio, selected, values, updateField, clearTemplate, onBrowse }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [references, setReferences] = useState<Reference[]>([]);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [previewReference, setPreviewReference] = useState<Reference | null>(null);
  const referenceStack = useRef<HTMLDivElement>(null);
  const referenceHover = useRef(false);
  const referencePickerOpen = useRef(false);
  const referenceTrigger = useRef<HTMLButtonElement>(null);
  const [model, setModel] = useState('gpt-image-2');
  const [resolution, setResolution] = useState('1K');
  const [count, setCount] = useState(1);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [detail, setDetail] = useState<{ turn: Turn; image: Reference } | null>(null);
  const [notice, setNotice] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [configured, setConfigured] = useState(false);
  const [enabledModels, setEnabledModels] = useState<string[]>(DEFAULT_IMAGE_MODELS);
  useEffect(() => { if (visible) void apiSettings().then(value => { setConfigured(value.hasKey); setEnabledModels(value.selectedModels); setModel(current => value.selectedModels.includes(current) ? current : value.selectedModels[0] || ''); }).catch(() => setConfigured(false)); }, [visible]);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const active = conversations.find(item => item.id === activeId);
  useEffect(() => {
    let cancelled = false;
    readConversations().then(items => {
      if (cancelled) return;
      const restored = items.map(c => ({ ...c, turns: c.turns.map(t => t.state === 'running' ? { ...t, state: 'interrupted' as const } : t) }));
      setConversations(restored); setActiveId(restored[0]?.id ?? ''); setLoaded(true);
    }).catch(() => { if (!cancelled) { setStorageError('无法访问浏览器存储，本次对话可能无法保存。'); setLoaded(true); } });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveConversations(conversations)).catch(() => { setStorageError('保存失败，请检查浏览器存储空间。'); });
  }, [conversations, loaded]);
  useEffect(() => { if (!detail) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setDetail(null); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [detail]);
  useEffect(() => {
    if (!referencesOpen) return;
    const closeOutside = (event: PointerEvent) => { if (!referenceStack.current?.contains(event.target as Node)) { setReferencesOpen(false); setPreviewReference(null); } };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setReferencesOpen(false); setPreviewReference(null); referenceTrigger.current?.focus(); } };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, [referencesOpen]);
  useEffect(() => { if (!references.length) { setReferencesOpen(false); setPreviewReference(null); } }, [references.length]);
  function newConversation() { setActiveId(''); setPrompt(''); setReferences([]); setReferencesOpen(false); clearTemplate(); setNotice(''); }
  function selectConversation(id: string) { setActiveId(id); setPrompt(''); setReferences([]); setReferencesOpen(false); clearTemplate(); setNotice(''); }
  function addReferences(files: FileList | null) {
    if (!files) return;
    const valid = Array.from(files).filter(file => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) && file.size <= 10 * 1024 * 1024);
    if (valid.length !== files.length) setNotice('仅支持小于 10 MB 的 PNG、JPEG、WebP 图片，其他文件已跳过。'); else setNotice('');
    void Promise.all(valid.map(file => new Promise<Reference>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve({ id: uid(), name: file.name, data: String(reader.result) }); reader.onerror = reject; reader.readAsDataURL(file); }))).then(items => setReferences(current => [...current, ...items])).catch(() => setNotice('读取图片失败，请重试。'));
  }
  function addReference(image: Reference) { setReferences(current => [...current, { ...image, id: uid() }]); setDetail(null); textarea.current?.focus(); }
  function mention(index: number) { const el = textarea.current; const text = `@参考图${index + 1} `; if (el) { const start = el.selectionStart; const end = el.selectionEnd; setPrompt(prompt.slice(0, start) + text + prompt.slice(end)); requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + text.length, start + text.length); }); } setSubjectsOpen(false); }
  async function submitImage() {
    if (!loaded) return;
    if (!prompt.trim()) { setNotice('请先输入画面描述。'); return; }
    if (!configured) { setNotice('请先在设置中配置图片 API。'); return; }
    if (!enabledModels.includes(model)) { setNotice('请先在设置中选择启用的图片模型。'); return; }
    if (references.some(ref => !/^data:image\/(png|jpeg|webp);/i.test(ref.data))) { setNotice('参考图需要是 PNG、JPEG 或 WebP 格式，请重新上传。'); return; }
    if (references.length > 4) { setNotice('最多添加 4 张参考图。'); return; }
    if (model === 'gemini-2.5-flash-image' && resolution !== '1K') { setNotice('Gemini 2.5 图片模型仅支持 1K。'); return; }
    const conversation = active ?? emptyConversation();
    const turn: Turn = { id: uid(), prompt: prompt.trim(), references, settings: { model, ratio, resolution, count }, images: [], state: 'running', created: Date.now() };
    setConversations(current => {
      const previous = current.find(item => item.id === conversation.id) ?? conversation;
      const next = { ...previous, title: previous.turns.length ? previous.title : turn.prompt.slice(0, 20), turns: [...previous.turns, turn], updated: Date.now() };
      return [next, ...current.filter(item => item.id !== next.id)];
    });
    setActiveId(conversation.id); setPrompt(''); setReferences([]); setReferencesOpen(false); clearTemplate(); setNotice('');
    requestAnimationFrame(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }));
    try {
      const images = await generateImage(turn.prompt, turn.settings, turn.references);
      setConversations(current => current.map(c => c.id !== conversation.id ? c : { ...c, turns: c.turns.map(t => t.id !== turn.id ? t : { ...t, state: 'complete', images }) }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败，请重试。';
      setConversations(current => current.map(c => c.id !== conversation.id ? c : { ...c, turns: c.turns.map(t => t.id !== turn.id ? t : { ...t, state: 'failed', error: message }) }));
    }
  }
  function editTurn(turn: Turn) { setPrompt(turn.prompt); setReferences(turn.references.map(ref => ({ ...ref, id: uid() }))); setModel(enabledModels.includes(turn.settings.model) ? turn.settings.model : enabledModels[0] || ''); setRatio(turn.settings.ratio); setResolution(turn.settings.resolution); setCount(1); textarea.current?.focus(); }
  function deleteConversation(id: string) { setConversations(current => current.filter(c => c.id !== id)); if (activeId === id) newConversation(); }
  return <section className="image-studio" aria-label="图片生成工作区">
    <aside className="image-history"><div className="history-heading"><div><span>IMAGE STUDIO</span><h2>创作对话</h2></div><button onClick={newConversation} aria-label="新建对话" title="新建对话"><Plus size={19}/></button></div><button className="new-conversation" onClick={newConversation}><Plus size={16}/> 新建创作 <span>NEW</span></button><div className="history-label">最近对话 <span>{conversations.length}</span></div><div className="history-list">{conversations.length ? conversations.map(c => <div className={`history-item ${activeId === c.id ? 'active' : ''}`} key={c.id}><button className="history-select" onClick={() => selectConversation(c.id)}><MessageSquare size={15}/><span>{c.title}</span></button><button className="history-delete" onClick={() => deleteConversation(c.id)} aria-label={`删除对话 ${c.title}`} title="删除对话"><Trash2 size={14}/></button></div>) : <p className="history-empty">你的创作对话会留在这里。</p>}</div><div className="history-foot"><span className="history-foot-icon"><Sparkles size={15}/></span><div><strong>灵感，随时继续</strong><small>对话保存在当前浏览器</small></div></div></aside>
    <div className="image-workspace"><div className="workspace-heading-new"><div><span className="workspace-overline">YOUR CREATIVE SPACE <span>/</span> 01</span><h1>{active?.title ?? '让想法，开始成形。'}</h1></div><button className="service-pill" onClick={onSettings}><span/> {configured ? '已配置图片服务' : '配置图片服务'}</button></div>
      <div className={`image-thread ${active?.turns.length ? 'has-turns' : ''}`}>
        {!active?.turns.length && <div className="image-welcome"><div className="welcome-visual" aria-hidden="true"><div className="welcome-card card-one"/><div className="welcome-card card-two"/><div className="welcome-star">✳</div></div><span className="welcome-overline">A LITTLE SPACE FOR BIG IDEAS</span><h2>每个画面，都从一个想法开始。</h2><p>输入描述，添加参考图片，慢慢探索你想象中的画面。</p><button onClick={onBrowse}>从提示词中寻找灵感 <ArrowRight size={15}/></button></div>}
        {active?.turns.map(turn => <article className="image-turn" key={turn.id}><div className="turn-top"><div className="turn-avatar"><Sparkles size={15}/></div><div className="turn-title"><div><strong>创作想法</strong><time>{new Date(turn.created).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div><p>{turn.prompt}</p>{turn.references.length > 0 && <div className="turn-refs">{turn.references.map((ref, i) => <img key={ref.id} src={ref.data} alt={`参考图 ${i + 1}`}/>)}</div>}<div className="turn-meta">{turn.settings.model} <i/> {turn.settings.ratio} <i/> {turn.settings.resolution} <i/> {turn.settings.count} 张 {turn.settings.model.startsWith('示例模型') && <span>演示</span>}</div></div></div>
          {turn.state === 'running' ? <div className="generation-grid" role="status" aria-label="图片生成中">{Array.from({ length: turn.settings.count }, (_, i) => <div className="generation-pending" key={i}><div className="pending-orb"/><span><LoaderCircle size={15} className="spin"/> 正在生成图片</span></div>)}</div> : turn.state === 'interrupted' ? <p className="interrupted">生成已中断，可重新编辑后再次提交。</p> : turn.state === 'failed' ? <p className="interrupted" role="alert">{turn.error || '生成失败，请重新编辑后重试。'}</p> : <div className="generation-grid">{turn.images.map(image => <div className="result-card" key={image.id}><button className="result-image" onClick={() => setDetail({ turn, image })} aria-label={`查看${image.name}详情`}><img src={image.data} alt={image.name}/>{turn.settings.model.startsWith('示例模型') && <span>演示图片</span>}</button><button className="result-reference" onClick={() => addReference(image)} title="用作参考图" aria-label={`将${image.name}用作参考图`}><ImagePlus size={15}/></button></div>)}</div>}
          <div className="turn-actions"><button onClick={() => editTurn(turn)}><Copy size={14}/> 重新编辑</button>{turn.settings.model.startsWith('示例模型') && <span>历史演示图片</span>}</div></article>)}<div ref={bottom}/>
      </div>
      <div className="composer-dock"><div className="demo-banner"><Sparkles size={14}/><span>添加参考图即可编辑或基于图片创作；模型需与密钥分组匹配。</span></div><div className="image-composer">
        {selected && <div className="composer-template"><div className="template-heading"><div><span>当前模板</span><strong>{selected.name}</strong></div><button className="template-clear" onClick={clearTemplate} aria-label="移除当前模板"><X size={15}/></button></div><div className="template-fields">{selected.fields.map(field => <label key={field.key}>{field.label}<input value={values[field.key] ?? ''} placeholder={field.placeholder} onChange={e => updateField(field.key, e.target.value)}/></label>)}</div></div>}
        <div className="composer-entry"><div className="reference-stack" ref={referenceStack} onPointerEnter={event => { if (event.pointerType === 'mouse' && references.length) { referenceHover.current = true; setReferencesOpen(true); } }} onPointerLeave={event => { if (event.pointerType === 'mouse') { referenceHover.current = false; if (!referencePickerOpen.current) setReferencesOpen(false); setPreviewReference(null); } }}>
          {references.length ? <><button ref={referenceTrigger} type="button" className="reference-stack-trigger" aria-label={`参考图 ${references.length} 张，${referencesOpen ? '收起' : '展开'}管理`} aria-expanded={referencesOpen} aria-controls="reference-stack-panel" onClick={() => { setReferencesOpen(open => referenceHover.current ? true : !open); setPreviewReference(null); }}><span className="stack-cards" aria-hidden="true">{references.slice(0, 3).map(ref => <img key={ref.id} src={ref.data} alt=""/>)}</span><span className="stack-count">{references.length}</span></button>
            <div id="reference-stack-panel" className={`reference-popover ${referencesOpen ? 'is-open' : 'is-closed'}`} aria-hidden={!referencesOpen} inert={!referencesOpen}><div className="reference-popover-heading"><span>参考图 <small>{references.length}</small></span><button type="button" onClick={() => { setReferencesOpen(false); setPreviewReference(null); referenceTrigger.current?.focus(); }} aria-label="收起参考图"><X size={15}/></button></div><div className="reference-popover-list">{references.map((ref, index) => <div className="reference-chip" key={ref.id} tabIndex={0} aria-label={`参考图 ${index + 1}，${ref.name}`} onMouseEnter={() => setPreviewReference(ref)} onMouseLeave={() => setPreviewReference(null)} onFocus={() => setPreviewReference(ref)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPreviewReference(null); }}><img src={ref.data} alt={`参考图 ${index + 1}`}/><button type="button" onClick={() => { setReferences(current => current.filter(item => item.id !== ref.id)); setPreviewReference(null); }} aria-label={`移除参考图 ${index + 1}`}><X size={12}/></button><span className="reference-number">{index + 1}</span></div>)}<label className="upload-tile" title="上传参考图"><Plus size={20}/><span className="sr-only">添加参考图</span><input type="file" accept="image/png,image/jpeg,image/webp" multiple aria-label="上传参考图" onClick={e => { referencePickerOpen.current = true; e.currentTarget.addEventListener('cancel', () => { referencePickerOpen.current = false; if (!referenceHover.current) setReferencesOpen(false); }, { once: true }); }} onChange={e => { referencePickerOpen.current = false; addReferences(e.target.files); e.currentTarget.value = ''; if (!referenceHover.current) setReferencesOpen(false); }}/></label></div></div>
            {referencesOpen && previewReference && <div className="stack-hover-preview" aria-hidden="true"><span>参考图 {references.findIndex(ref => ref.id === previewReference.id) + 1}</span><img src={previewReference.data} alt=""/></div>}
          </> : <label className="upload-tile" title="上传参考图"><Plus size={20}/><span className="sr-only">添加参考图</span><input type="file" accept="image/png,image/jpeg,image/webp" multiple aria-label="上传参考图" onChange={e => { addReferences(e.target.files); e.currentTarget.value = ''; }}/></label>}
        </div><div className="entry-main"><textarea ref={textarea} value={prompt} onChange={e => { setPrompt(e.target.value); if (e.target.value.endsWith('@')) setSubjectsOpen(true); }} placeholder="上传参考图，输入文字或 @ 参考图，描述你想生成的图片。" aria-label="图片描述" rows={3}/>{subjectsOpen && <div className="subject-menu"><div>引用参考图</div>{references.length ? references.map((ref, index) => <button key={ref.id} onClick={() => { if (prompt.endsWith('@')) setPrompt(current => current.slice(0, -1) + `@参考图${index + 1} `); else mention(index); setSubjectsOpen(false); textarea.current?.focus(); }}><img src={ref.data} alt=""/>参考图{index + 1}</button>) : <p>先上传参考图，再通过 @ 引用。</p>}<button className="subject-close" onClick={() => setSubjectsOpen(false)}>关闭</button></div>}</div></div>
        <div className="image-toolbar"><div className="image-options"><span className="mode-label"><Images size={15}/> 图片生成</span>{enabledModels.length ? <StudioSelect label="选择模型" value={model} onChange={setModel} options={enabledModels.map(value => ({value,label:value}))}/> : <button className="at-button" onClick={onSettings}>选择模型</button>}<StudioSelect label="选择比例" value={ratio} onChange={setRatio} layout="ratios" options={['1:1','4:5','3:4','16:9','9:16'].map(value => ({value,label:value}))}/><StudioSelect label="选择分辨率" value={resolution} onChange={setResolution} layout="segments" options={['1K','2K','4K'].map(value => ({value,label:value}))}/><button className="at-button" onClick={() => setSubjectsOpen(open => !open)} aria-label="引用参考图"><AtSign size={16}/></button></div><button className="demo-send" onClick={() => void submitImage()} disabled={!loaded}><span>生成图片</span><ArrowUp size={17}/></button></div>
      </div>{(notice || storageError) && <p className="studio-notice" role="alert">{notice || storageError}</p>}<p className="composer-caption">对话、参考图和生成结果保存在当前浏览器</p></div>
    </div>
    {detail && <div className="image-detail-backdrop" onClick={() => setDetail(null)}><section className="image-detail" role="dialog" aria-modal="true" aria-label="图片详情" onClick={e => e.stopPropagation()}><button className="image-detail-close" onClick={() => setDetail(null)} aria-label="关闭图片详情" autoFocus><X size={20}/></button><div className="detail-image-stage"><img src={detail.image.data} alt={detail.image.name}/></div><div className="image-detail-info"><span className="detail-overline">IMAGE DETAILS / 图片详情</span><h2>创作的另一种可能。</h2>{detail.turn.settings.model.startsWith('示例模型') && <span className="demo-tag">演示图片</span>}<div className="detail-thumbnails">{detail.turn.images.map(image => <button key={image.id} className={image.id === detail.image.id ? 'active' : ''} onClick={() => setDetail({ ...detail, image })} aria-label={`查看${image.name}`}><img src={image.data} alt=""/></button>)}</div><div className="detail-prompt"><span>图片描述</span><p>{detail.turn.prompt}</p></div><div className="detail-spec"><span>模型</span><strong>{detail.turn.settings.model}</strong><span>比例 / 分辨率</span><strong>{detail.turn.settings.ratio} / {detail.turn.settings.resolution}</strong></div><button className="detail-reference-button" onClick={() => addReference(detail.image)}><ImagePlus size={16}/> 用作参考图 <ChevronRight size={16}/></button><button className="detail-edit-button" onClick={() => { editTurn(detail.turn); setDetail(null); }}><RotateCcw size={15}/> 重新编辑这次描述</button><a className="detail-edit-button" href={detail.image.data} download={detail.image.name + (detail.image.data.startsWith('data:image/webp') ? '.webp' : detail.image.data.startsWith('data:image/jpeg') ? '.jpg' : '.png')}>下载图片</a></div></section></div>}
  </section>;
}
