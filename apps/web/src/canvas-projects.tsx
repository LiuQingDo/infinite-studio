import { useEffect, useState } from 'react';
import { ArrowUp, Folder, Pencil, Plus, Trash2 } from 'lucide-react';
import { CanvasProjectEditor } from './canvas-editor';
import './canvas-projects.css';

export type CanvasItem = { id: string; position: { x: number; y: number }; kind: 'note' | 'image'; text: string; name?: string };
export type CanvasEdge = { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null };
export type CanvasProject = { id: string; name: string; updatedAt: number; items: CanvasItem[]; edges?: CanvasEdge[] };
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const request = indexedDB.open('infinite-studio-canvas', 1); request.onupgradeneeded = () => request.result.createObjectStore('projects', { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function projectsTransaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try { return await new Promise<T>((resolve, reject) => { const tx = db.transaction('projects', mode); const request = action(tx.objectStore('projects')); tx.oncomplete = () => resolve(request.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); } finally { db.close(); }
}
const listProjects = () => projectsTransaction('readonly', store => store.getAll() as IDBRequest<CanvasProject[]>);
export const saveProject = (project: CanvasProject) => projectsTransaction('readwrite', store => store.put(project));
const deleteProject = (id: string) => projectsTransaction('readwrite', store => store.delete(id));
export function CanvasProjects() {
  const [projects, setProjects] = useState<CanvasProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [idea, setIdea] = useState('');
  const [active, setActive] = useState<CanvasProject | null>(null);
  const [saving, setSaving] = useState(false);
  async function refresh() { try { const result = await listProjects(); setProjects(result.sort((a, b) => b.updatedAt - a.updatedAt)); setError(''); } catch { setError('无法读取本地项目，请检查浏览器存储权限。'); } finally { setLoading(false); } }
  useEffect(() => { void refresh(); }, []);
  async function createProject(withIdea = false) {
    if (saving) return;
    setSaving(true);
    const text = withIdea ? idea.trim() : '';
    const project: CanvasProject = { id: crypto.randomUUID(), name: '未命名项目', updatedAt: Date.now(), items: text ? [{ id: crypto.randomUUID(), position: { x: 80, y: 80 }, kind: 'note', text }] : [] };
    try { await saveProject(project); setIdea(''); setError(''); setActive(project); } catch { setError('创建失败，请检查浏览器存储空间和权限。'); } finally { setSaving(false); }
  }
  async function renameProject(project: CanvasProject) {
    const name = window.prompt('请输入项目名称', project.name)?.trim();
    if (!name || name === project.name) return;
    try { await saveProject({ ...project, name }); await refresh(); } catch { setError('重命名失败，请重试。'); }
  }
  async function removeProject(project: CanvasProject) {
    if (!window.confirm(`删除项目“${project.name}”？项目中的画布内容也会从此浏览器移除。`)) return;
    try { await deleteProject(project.id); await refresh(); } catch { setError('删除失败，请重试。'); }
  }
  if (active) return <CanvasProjectEditor project={active} onBack={() => { setActive(null); void refresh(); }}/>;
  return <section className="canvas-projects" aria-label="画布项目"><div className="canvas-projects-inner">
    <div className="canvas-projects-intro"><div className="canvas-projects-title"><span className="canvas-projects-mark">∞</span><h1>今天要做点什么？</h1></div>
      <div className="canvas-composer"><textarea value={idea} onChange={event => setIdea(event.target.value)} aria-label="创作描述" placeholder="描述你想创作的内容，让灵感从这里开始…" rows={3}/><div className="canvas-composer-footer"><span>灵感将作为笔记添加到画布</span><button onClick={() => void createProject(true)} disabled={saving}><ArrowUp size={17}/> 创建画布</button></div></div><p className="canvas-projects-hint">项目保存在当前浏览器中，清除浏览器数据可能导致项目丢失。</p>
    </div>
    {error && <p className="canvas-project-error" role="alert">{error}</p>}
    <section className="canvas-project-list" aria-labelledby="canvas-project-list-title"><h2 id="canvas-project-list-title">项目</h2><div className="canvas-project-grid"><button className="canvas-project-new" disabled={saving || loading} onClick={() => void createProject()}><span><Plus size={24}/></span><strong>新建项目</strong><small>从空白画布开始</small></button>{projects.map(project => <article className="canvas-project-card" key={project.id}><button className="canvas-project-open" onClick={() => setActive(project)} aria-label={`打开项目 ${project.name}`}><span className="canvas-project-cover">{project.items.find(item => item.kind === 'image') ? <img src={project.items.find(item => item.kind === 'image')!.text} alt=""/> : <Folder size={36}/>}</span><span className="canvas-project-info"><strong>{project.name}</strong><small>最近更新 {new Date(project.updatedAt).toLocaleString('zh-CN', { hour12: false })}</small></span></button><div className="canvas-project-actions"><button title="重命名" aria-label={`重命名项目 ${project.name}`} onClick={() => void renameProject(project)}><Pencil size={15}/></button><button title="删除项目" aria-label={`删除项目 ${project.name}`} onClick={() => void removeProject(project)}><Trash2 size={15}/></button></div></article>)}</div>{loading && <p className="canvas-projects-hint">正在读取项目…</p>}</section>
    <section className="canvas-explore"><div><h2>探索</h2><span>作品探索尚未接通</span></div></section>
  </div></section>;
}

