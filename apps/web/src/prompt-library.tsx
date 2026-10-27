import { useEffect, useMemo, useState } from 'react';
import { Copy, FileText, FolderPlus, Search, X } from 'lucide-react';
import './prompt-library.css';

type Prompt = { id: string; title: string; prompt: string; description: string; coverUrl: string; referenceImageUrls: string[]; tags: string[]; preview: string; source: string; sourceUrl: string };
const sources = [
  ['banana-prompt-quicker', 'Banana Prompt Quicker'], ['davidwu-gpt-image2-prompts', 'DavidWu GPT Image 2'],
  ['freestylefly-gpt-image-2', 'Freestylefly GPT Image 2'], ['awesome-gpt-image', 'Awesome GPT Image'],
  ['awesome-gpt4o-image-prompts', 'Awesome GPT-4o'], ['youmind-gpt-image-2', 'YouMind GPT Image 2'],
  ['youmind-nano-banana-pro', 'YouMind Nano Banana Pro'],
] as const;
const base = 'https://raw.githubusercontent.com/yukkcat/image-prompts/main/dist/sources/';

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('infinite-studio-prompts', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('data');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function read<T>(key: string): Promise<T | undefined> {
  const db = await database();
  try { return await new Promise((resolve, reject) => { const request = db.transaction('data').objectStore('data').get(key); request.onsuccess = () => resolve(request.result as T | undefined); request.onerror = () => reject(request.error); }); }
  finally { db.close(); }
}
async function write(key: string, value: unknown): Promise<void> {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('data', 'readwrite'); tx.objectStore('data').put(value, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); }
  finally { db.close(); }
}
function normalize(data: unknown, id: string, source: string): Prompt[] {
  if (!Array.isArray(data)) throw new Error('来源格式无效');
  const seen = new Set<string>();
  return data.flatMap((value: unknown, index): Prompt[] => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    if (typeof item.title !== 'string' || !item.title.trim() || typeof item.prompt !== 'string' || !item.prompt.trim()) return [];
    const itemId = `${id}:${String(item.id || index)}`;
    if (seen.has(itemId)) return [];
    seen.add(itemId);
    const absolute = (value: unknown) => { if (typeof value !== 'string' || !value) return ''; try { const url = new URL(value, base + id + '.json'); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
    const images = Array.isArray(item.referenceImageUrls) ? item.referenceImageUrls.map(absolute).filter(Boolean) : [];
    return [{ id: itemId, title: item.title, prompt: item.prompt, description: typeof item.description === 'string' ? item.description : '', coverUrl: absolute(item.coverUrl) || images[0] || '', referenceImageUrls: images, tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string' && !!tag.trim()) : [], preview: typeof item.preview === 'string' ? item.preview : '', source, sourceUrl: absolute(item.sourceUrl) }];
  });
}
async function loadSource(id: string, name: string): Promise<{ items: Prompt[]; cached: boolean }> {
  try {
    const response = await fetch(`${base}${id}.json`);
    if (!response.ok) throw new Error('请求失败');
    const items = normalize(await response.json(), id, name);
    if (!items.length) throw new Error('没有提示词');
    void write(`source:${id}`, items).catch(() => {});
    return { items, cached: false };
  } catch {
    const items = await read<Prompt[]>(`source:${id}`).catch(() => undefined);
    if (items?.length) return { items, cached: true };
    throw new Error(name);
  }
}

export function PromptLibrary({ onUse }: { onUse: (text: string) => void }) {
  const [items, setItems] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [failures, setFailures] = useState<string[]>([]);
  const [cached, setCached] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [category, setCategory] = useState('全部');
  const [tags, setTags] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [visible, setVisible] = useState(20);
  const [selected, setSelected] = useState<Prompt | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setFailures([]); setCached([]);
    void Promise.allSettled(sources.map(([id, name]) => loadSource(id, name))).then(results => {
      if (!active) return;
      setItems(results.flatMap(result => result.status === 'fulfilled' ? result.value.items : []));
      setFailures(results.flatMap((result, index) => result.status === 'rejected' ? [sources[index][1]] : []));
      setCached(results.flatMap((result, index) => result.status === 'fulfilled' && result.value.cached ? [sources[index][1]] : []));
      setLoading(false);
    });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => { setVisible(20); }, [category, tags, keyword]);
  const withoutTags = useMemo(() => items.filter(item => (category === '全部' || item.source === category) && [item.title, item.prompt, item.description, item.source, ...item.tags].join(' ').toLowerCase().includes(keyword.trim().toLowerCase())), [items, category, keyword]);
  const availableTags = useMemo(() => Array.from(new Set(withoutTags.flatMap(item => item.tags))), [withoutTags]);
  const filtered = useMemo(() => withoutTags.filter(item => !tags.length || tags.some(tag => item.tags.includes(tag))), [withoutTags, tags]);
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); setNotice('提示词已复制'); } catch { setNotice('复制失败，请在详情中手动复制'); } }
  async function save(item: Prompt) { try { const saved = await read<Prompt[]>('saved') || []; await write('saved', [item, ...saved.filter(other => other.id !== item.id)]); setNotice('已加入我的提示词'); } catch { setNotice('保存失败，请检查浏览器存储权限'); } }
  return <section className="prompt-library">
    <div className="prompt-library-heading"><h1>提示词库</h1><p>共 {filtered.length} 条提示词</p></div>
    {(failures.length > 0 || cached.length > 0) && <div className="prompt-warning" role="status">{failures.length > 0 && <span>部分来源加载失败：{failures.join('、')}。 </span>}{cached.length > 0 && <span>使用上次缓存：{cached.join('、')}。 </span>}<button onClick={() => setAttempt(value => value + 1)}>重试</button></div>}
    {notice && <div className="prompt-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice('')}><X size={14}/></button></div>}
    <div className="prompt-layout"><aside className="prompt-filters"><div className="prompt-filter-title">分类</div><div className="prompt-filter-options">{['全部', ...sources.map(source => source[1])].map(option => <button key={option} className={category === option ? 'active' : ''} onClick={() => { setCategory(option); setTags([]); }}>{option}</button>)}</div><div className="prompt-filter-title tags-title">标签</div><div className="prompt-filter-options"><button className={!tags.length ? 'active' : ''} onClick={() => setTags([])}>全部</button>{availableTags.map(tag => <button key={tag} className={tags.includes(tag) ? 'active' : ''} onClick={() => setTags(current => current.includes(tag) ? current.filter(value => value !== tag) : [...current, tag])}>{tag}</button>)}</div></aside>
      <div className="prompt-results"><label className="prompt-search"><Search size={17}/><span className="sr-only">搜索提示词</span><input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="搜索提示词"/></label>
        {loading ? <div className="prompt-state">正在加载提示词…</div> : filtered.length === 0 ? <div className="prompt-state">{failures.length === sources.length ? '无法加载提示词，请检查网络后重试。' : '没有找到相关提示词。'}</div> : <><div className="prompt-grid">{filtered.slice(0, visible).map(item => <PromptCard key={item.id} item={item} onOpen={() => setSelected(item)} onCopy={() => void copy(item.prompt)} onSave={() => void save(item)}/>)}</div><div className="prompt-more">{visible < filtered.length ? <button onClick={() => setVisible(value => value + 20)}>加载更多</button> : '已经到底了'}</div></>}
      </div></div>
    {selected && <PromptDialog item={selected} onClose={() => setSelected(null)} onCopy={() => void copy(selected.prompt)} onSave={() => void save(selected)} onUse={() => onUse(selected.prompt)}/>}
  </section>;
}
function PromptCard({ item, onOpen, onCopy, onSave }: { item: Prompt; onOpen: () => void; onCopy: () => void; onSave?: () => void }) {
  return <article className="prompt-card"><button className="prompt-card-open" onClick={onOpen}>{item.coverUrl ? <img src={item.coverUrl} alt={item.title} loading="lazy"/> : <span className="prompt-image-empty"><FileText size={30}/></span>}<div className="prompt-card-body"><h2>{item.title}</h2><p>{item.description || item.prompt}</p><div className="prompt-card-tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div></button><div className="prompt-actions"><button onClick={onCopy}><Copy size={14}/> 复制</button>{onSave && <button onClick={onSave}><FolderPlus size={14}/> 加入素材</button>}</div></article>;
}
function PromptDialog({ item, onClose, onCopy, onSave, onUse }: { item: Prompt; onClose: () => void; onCopy: () => void; onSave?: () => void; onUse: () => void }) {
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [onClose]);
  return <div className="modal-backdrop" onClick={onClose}><section className="prompt-dialog" role="dialog" aria-modal="true" aria-labelledby="prompt-dialog-title" onClick={event => event.stopPropagation()}><div className="prompt-dialog-header"><h2 id="prompt-dialog-title">{item.title}</h2><button autoFocus aria-label="关闭详情" onClick={onClose}><X size={19}/></button></div><div className="prompt-dialog-content">{item.coverUrl ? <img className="prompt-dialog-cover" src={item.coverUrl} alt={item.title}/> : <div className="prompt-dialog-cover prompt-image-empty"><FileText size={34}/></div>}{item.referenceImageUrls.length > 1 && <div className="prompt-references">{item.referenceImageUrls.filter(url => url !== item.coverUrl).slice(0, 6).map(url => <img key={url} src={url} alt="参考图" loading="lazy"/>)}</div>}<div className="prompt-card-tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div>{item.description && <p>{item.description}</p>}{item.preview && <pre>{item.preview}</pre>}<p className="prompt-text">{item.prompt}</p><p className="prompt-source">来源：{item.source} {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">查看来源 ↗</a>}</p></div><div className="prompt-dialog-actions"><button className="dark-button" onClick={onCopy}><Copy size={15}/> 复制提示词</button>{onSave && <button className="outline-button" onClick={onSave}><FolderPlus size={15}/> 加入素材</button>}<button className="outline-button" onClick={onUse}>用于图片创作</button></div></section></div>;
}
export function SavedPromptAssets({ onUse }: { onUse: (text: string) => void }) {
  const [items, setItems] = useState<Prompt[]>([]); const [selected, setSelected] = useState<Prompt | null>(null); const [notice, setNotice] = useState('');
  useEffect(() => { void read<Prompt[]>('saved').then(value => setItems(value || [])).catch(() => setNotice('无法读取浏览器中保存的提示词。')); }, []);
  async function copy(item: Prompt) { try { await navigator.clipboard.writeText(item.prompt); setNotice('提示词已复制'); } catch { setNotice('复制失败，请在详情中手动复制'); } }
  async function remove(item: Prompt) { const next = items.filter(value => value.id !== item.id); try { await write('saved', next); setItems(next); setNotice('已移除'); } catch { setNotice('移除失败，请检查浏览器存储权限'); } }
  return <div className="saved-prompts">{notice && <p role="status">{notice}</p>}{items.length ? <div className="prompt-grid">{items.map(item => <article key={item.id}><PromptCard item={item} onOpen={() => setSelected(item)} onCopy={() => void copy(item)}/><button className="saved-remove" onClick={() => void remove(item)}>从素材中移除</button></article>)}</div> : <div className="prompt-state">还没有保存的提示词。可以从提示词库加入素材。</div>}{selected && <PromptDialog item={selected} onClose={() => setSelected(null)} onCopy={() => void copy(selected)} onUse={() => onUse(selected.prompt)}/>}</div>;
}
