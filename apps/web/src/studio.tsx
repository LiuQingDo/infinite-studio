import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient, type Session } from '@supabase/supabase-js';
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, BookOpen, Check, ChevronDown, FolderHeart, Grid2X2, Image, LayoutGrid, Plus, Sparkles, StickyNote, UserRound, X } from 'lucide-react';
import type { ImageTask, ServiceStatus, TaskStatus } from '@infinite-studio/contracts';
import { buildPrompt, templates, type Template } from './templates';
import { PromptLibrary, SavedPromptAssets } from './prompt-library';
import './create.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = url && key ? createClient(url, key) : null;
const taskLabels: Record<TaskStatus, string> = { queued: '排队中', submitting: '提交中', running: '生成中', succeeded: '已完成', failed: '失败', unknown: '状态待确认' };
type Page = 'home' | 'templates' | 'create' | 'canvas' | 'assets' | 'account';
type AssetCategory = 'prompts' | 'favorites' | 'images';
const assetCategories: { id: AssetCategory; label: string; icon: typeof Grid2X2; title: string; description: string; action: string; destination: 'templates' | 'create' }[] = [
  { id: 'prompts', label: '我的提示词', icon: StickyNote, title: '你的提示词，留在这里。', description: '提示词保存功能尚未接通。你可以先在图片生成中编辑创意。', action: '前往图片生成', destination: 'create' },
  { id: 'favorites', label: '收藏提示词', icon: FolderHeart, title: '收藏值得回来的灵感。', description: '提示词收藏功能尚未接通。先去提示词库寻找创作起点。', action: '浏览提示词库', destination: 'templates' },
  { id: 'images', label: '已生成图片', icon: Image, title: '为作品留一处空间。', description: '图片生成和作品保存功能尚未接通，生成后的图片将在这里查看。', action: '前往图片生成', destination: 'create' },
];

async function readJson<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!response.ok) throw new Error('服务暂不可用');
  return response.json() as Promise<T>;
}

function TemplateArt({ tone }: { tone: string }) {
  return <div className={`template-art ${tone}`} aria-hidden="true"><span className="art-sun"/><span className="art-shape"/><span className="art-line"/><span className="art-caption">灵感 / 进行中</span></div>;
}

export function App() {
  const [page, setPage] = useState<Page>('home');
  const [canvasProjectOpen, setCanvasProjectOpen] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const canvasFrame = useRef<HTMLIFrameElement>(null);
  const [assetCategory, setAssetCategory] = useState<AssetCategory>('prompts');
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [detail, setDetail] = useState<Template | null>(null);
  const [selected, setSelected] = useState<Template | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('1:1');
  const [ratioOpen, setRatioOpen] = useState(false);
  const ratioMenu = useRef<HTMLDivElement>(null);
  const ratioTrigger = useRef<HTMLButtonElement>(null);
  const [reference, setReference] = useState<{ name: string; data: string } | null>(null);
  useEffect(() => {
    if (!ratioOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!ratioMenu.current?.contains(event.target as Node)) setRatioOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setRatioOpen(false); ratioTrigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOnOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, [ratioOpen]);
  useEffect(() => {
    const onCanvasRoute = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== canvasFrame.current?.contentWindow || event.data?.type !== 'infinite-studio:canvas-route') return;
      setCanvasProjectOpen(event.data.projectOpen === true);
      setCanvasReady(true);
    };
    window.addEventListener('message', onCanvasRoute);
    return () => window.removeEventListener('message', onCanvasRoute);
  }, []);
  const status = useQuery({ queryKey: ['status'], queryFn: () => readJson<ServiceStatus>('/api/status'), retry: false });
  const tasks = useQuery({ queryKey: ['tasks', session?.user.id], queryFn: () => readJson<{ tasks: ImageTask[] }>('/api/tasks', session!.access_token), enabled: Boolean(session), retry: false });
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!detail) return;
    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetail(null);
      if (event.key !== 'Tab') return;
      const buttons = document.querySelectorAll<HTMLButtonElement>('.detail-modal button');
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1]?.focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0]?.focus(); }
    };
    window.addEventListener('keydown', handleDialogKeys);
    return () => window.removeEventListener('keydown', handleDialogKeys);
  }, [detail]);
  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPassword('');
    setMessage(error ? '登录失败，请检查账号信息后重试。' : '');
  }
  function start(template: Template | null) {
    setSelected(template); setValues({}); setPrompt(''); setRatio(template?.ratio ?? '1:1'); setReference(null); setDetail(null); setPage('create');
  }
  function useLibraryPrompt(text: string) {
    setSelected(null); setValues({}); setPrompt(text); setRatio('1:1'); setReference(null); setDetail(null); setPage('create');
  }
  function updateField(key: string, value: string) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (selected) setPrompt(buildPrompt(selected, next));
  }
  function loadImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) { setMessage('请选择小于 10 MB 的图片。'); return; }
    setMessage('');
    const reader = new FileReader();
    reader.onerror = () => setMessage('无法读取图片，请重试。');
    reader.onload = () => setReference({ name: file.name, data: String(reader.result) });
    reader.readAsDataURL(file);
  }
  const service = status.isError ? '服务暂不可用' : status.isPending ? '正在检查服务' : '工作区已连接';
  const navigation: { id: Page; label: string; icon: typeof Grid2X2 }[] = [{ id: 'home', label: '首页', icon: Grid2X2 }, { id: 'templates', label: '提示词库', icon: BookOpen }, { id: 'create', label: '图片生成', icon: Sparkles }, { id: 'canvas', label: '画布项目', icon: LayoutGrid }, { id: 'assets', label: '资产', icon: FolderHeart }];
  const activeAssetCategory = assetCategories.find(item => item.id === assetCategory)!;
  return <div className="app-shell">
    <aside className="rail" aria-label="主导航">
      <button className="brand" onClick={() => setPage('home')} aria-label="Infinite Studio 首页"><span className="brand-mark">∞</span><span>infinite<br/><b>studio</b></span></button>
      <div className="rail-section">我的工作区</div>
      <nav>{navigation.map(item => <button key={item.id} aria-label={item.label} className={`rail-item ${page === item.id ? 'selected' : ''}`} aria-current={page === item.id ? 'page' : undefined} onClick={() => setPage(item.id)}><item.icon size={17}/><span>{item.label}</span>{page === item.id && <span className="nav-dot"/>}</button>)}</nav>
      <div className="rail-spacer"/><button aria-label="账户" aria-current={page === 'account' ? 'page' : undefined} className={`rail-item account-link ${page === 'account' ? 'selected' : ''}`} onClick={() => setPage('account')}><UserRound size={17}/><span>账户</span></button><div className="rail-footer"><span className="status-dot"/>{service}</div>
    </aside>
    <main className={`main ${page === 'canvas' ? 'main-canvas' : ''} ${page === 'create' ? 'main-create' : ''}`} >
      <header className="topbar"><span>INFINITE STUDIO <span className="slash">/</span> {navigation.find(item => item.id === page)?.label ?? '账户'}</span><span className="top-right"><span className="status-dot"/> 为创意留一片空间</span></header>
      <div className={`content ${page === 'canvas' ? 'content-canvas' : ''} ${page === 'create' ? 'content-create' : ''}`}>
        {page === 'home' && <>
          <div className="hero"><div><div className="eyebrow"><span/> 你的创作空间</div><h1>让想法<br/><em>自由生长。</em></h1><p>从最初的念头到视觉创意，找到适合的起点，让灵感慢慢成形。</p><div className="hero-actions"><button className="dark-button" onClick={() => setPage('templates')}>探索模板 <ArrowRight size={16}/></button><button className="text-button" onClick={() => start(null)}>自由创作 <ArrowUpRight size={15}/></button></div></div><div className="hero-art" aria-hidden="true"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-disc"><span>∞</span></div><span className="hero-art-label">为灵感<br/>留一片空间</span><span className="hero-art-index">图 01 / 从这里开始</span></div></div>
          <div className="section-heading"><div><span className="section-number">01 / 找到创作起点</span><h2>从一个想法开始。</h2><p>浏览示例提示词模板，或从空白页面自由创作。</p></div><button className="text-button" onClick={() => setPage('templates')}>浏览提示词库 <ArrowRight size={16}/></button></div>
          <div className="template-grid home-grid">{templates.slice(0, 3).map((template, index) => <TemplateCard key={template.id} template={template} index={index} onOpen={() => setDetail(template)}/>)}</div>
          <div className="canvas-promo"><div><span className="section-number">02 / 探索更多可能</span><h2>让一张图片<br/><em>延伸更多灵感。</em></h2><p>在画布上整理参考图和笔记，项目保存在当前浏览器中。</p><button className="text-button" onClick={() => setPage('canvas')}>打开画布 <ArrowRight size={16}/></button></div><div className="promo-art" aria-hidden="true"><span>让想法<br/>在这里汇聚。</span><div className="promo-card">✳</div><div className="promo-card second">一点<br/><i>灵感</i></div></div></div>
        </>}
        {page === 'templates' && <PromptLibrary onUse={useLibraryPrompt}/>}
        {page === 'create' && <section className="create-conversation" aria-labelledby="create-title">
          <div className="conversation-heading"><div><span className="conversation-kicker"><span/> IMAGE STUDIO / 创作空间</span><h1 id="create-title">你好，今天想要<span>创作什么？</span></h1><p>从一句描述开始，让你的想法慢慢成形。</p></div><span className="conversation-status"><span/> 生成服务尚未接通</span></div>
          <div className="conversation-body">
            <div className="conversation-composer">
              {selected && <div className="composer-template"><div className="template-heading"><div><span>当前模板</span><strong>{selected.name}</strong></div><button className="template-clear" onClick={() => { setSelected(null); setValues({}); }} aria-label="移除当前模板"><X size={15}/></button></div><p>填写字段生成提示词草稿，完成后可继续编辑。</p><div className="template-fields">{selected.fields.map(field => <label key={field.key}>{field.label}<input value={values[field.key] ?? ''} placeholder={field.placeholder} onChange={e => updateField(field.key, e.target.value)}/></label>)}</div></div>}
              <div className="composer-input-row">
                <div className="composer-reference-slot"><label className={`composer-upload ${reference ? 'has-reference' : ''}`} title={reference ? '更换参考图' : '添加参考图'}>{reference ? <img src={reference.data} alt="已选择的参考图"/> : <><Plus size={20}/><span className="sr-only">添加参考图</span></>}<input type="file" accept="image/*" aria-label={reference ? '更换参考图' : '添加参考图'} onChange={e => { loadImage(e.target.files?.[0]); e.currentTarget.value = ''; }}/></label>{reference && <button type="button" className="reference-remove" aria-label={`移除参考图 ${reference.name}`} onClick={() => setReference(null)}><X size={13}/></button>}</div>
                <label className="sr-only" htmlFor="create-prompt">描述你想创作的画面</label><textarea id="create-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="添加参考图，输入文字，描述你想生成的图片。" rows={4}/>
              </div>
              <div className="composer-toolbar"><div className="composer-options"><span className="composer-mode"><Image size={16}/> 图片生成</span><span className="composer-divider" aria-hidden="true"/><div className="composer-ratio" ref={ratioMenu} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setRatioOpen(false); }}><button ref={ratioTrigger} className="ratio-trigger" type="button" aria-label={`图片比例 ${ratio}`} aria-expanded={ratioOpen} aria-controls="ratio-options" onClick={() => setRatioOpen(open => !open)}><span>比例</span><strong>{ratio}</strong><ChevronDown size={14}/></button>{ratioOpen && <div id="ratio-options" className="ratio-menu" role="group" aria-label="选择图片比例">{['1:1', '4:5', '3:4', '16:9', '9:16'].map(option => <button key={option} type="button" aria-pressed={ratio === option} onClick={() => { setRatio(option); setRatioOpen(false); ratioTrigger.current?.focus(); }}><span>{option}</span>{ratio === option && <Check size={14}/>}</button>)}</div>}</div></div><button className="composer-send" disabled aria-label="生成图片（服务尚未接通）" title="生成服务尚未接通"><ArrowUp size={19}/></button></div>
            </div>
            {message && <p className="form-message" role="alert">{message}</p>}
            <p className="composer-note">图片生成服务尚未接通，当前可以先编辑提示词和选择参考图。</p>
            <div className="conversation-inspiration"><div className="inspiration-heading"><div><span>需要一点灵感？</span><p>从示例模板开始，或探索更多提示词。</p></div><button onClick={() => setPage('templates')}>浏览提示词库 <ArrowUpRight size={15}/></button></div><div className="inspiration-list">{templates.slice(0, 3).map((template, index) => <button key={template.id} onClick={() => start(template)}><span className="inspiration-index">0{index + 1}</span><span><strong>{template.name}</strong><small>{template.task}</small></span><ArrowUpRight size={16}/></button>)}</div></div>
          </div>
        </section>}
        {page === 'canvas' && !canvasReady && <div className="canvas-loading" role="status">正在加载画布工作区…</div>}
        <iframe ref={canvasFrame} className={`embedded-canvas ${page === 'canvas' && canvasProjectOpen ? 'canvas-fullscreen' : ''}`} hidden={page !== 'canvas'} title="无限画布" src="/canvas-app/#/canvas"/>
        {page === 'assets' && <section className="assets-page" aria-labelledby="assets-title">
          <div className="page-heading"><span className="section-number">我的资产 / 04</span><h1 id="assets-title">收藏每一个<em>创作灵感。</em></h1><p>在这里整理提示词和生成的图片，让灵感随时可以继续。</p></div>
          <div className="assets-shelf">
            <div className="assets-shelf-heading"><div><span className="section-number">YOUR COLLECTION</span><h2>我的资产</h2></div><span className="assets-shelf-note">提示词与图片</span></div>
            <div className="asset-tabs" aria-label="资产分类">{assetCategories.map(item => <button key={item.id} className={`asset-tab ${assetCategory === item.id ? 'active' : ''}`} aria-pressed={assetCategory === item.id} onClick={() => setAssetCategory(item.id)}><item.icon size={16}/>{item.label}</button>)}</div>
            {assetCategory === 'prompts' ? <SavedPromptAssets onUse={useLibraryPrompt}/> : <div className="asset-empty"><div className="asset-empty-icon"><activeAssetCategory.icon size={25}/></div><span className="section-number">{activeAssetCategory.label}</span><h3>{activeAssetCategory.title}</h3><p>{activeAssetCategory.description}</p><button className="outline-button" onClick={() => setPage(activeAssetCategory.destination)}>{activeAssetCategory.action} <ArrowRight size={15}/></button></div>}
          </div>
        </section>}
        {page === 'account' && <div className="account-page"><span className="section-number">我的账户</span><h1>属于你的<em>创作空间。</em></h1><div className="account-card">{session ? <><h2>欢迎回来。</h2><p>已登录：{session.user.email}</p><button className="outline-button" onClick={() => void supabase?.auth.signOut()}>退出登录</button><div className="task-list"><h3>最近任务</h3>{tasks.isPending ? <p>加载中…</p> : tasks.isError ? <p>暂时无法获取任务，请稍后重试。</p> : tasks.data?.tasks.length ? tasks.data.tasks.map(task => <p key={task.id}>{taskLabels[task.status] ?? '状态未知'} · {new Date(task.created_at).toLocaleDateString('zh-CN')}</p>) : <p>暂无任务。</p>}</div></> : supabase ? <><h2>登录账户。</h2><p>使用已有账户登录，查看最近任务。</p><form onSubmit={signIn}><label className="field">邮箱<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"/></label><label className="field">密码<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"/></label><button className="dark-button" type="submit">登录 <ArrowRight size={15}/></button>{message && <p role="alert">{message}</p>}</form></> : <><h2>账户尚未接通。</h2><p>配置工作区后即可登录。</p></>}</div></div>}
        {page !== 'canvas' && page !== 'create' && <footer><span>INFINITE STUDIO ©</span><span>让创意继续生长 <ArrowUpRight size={12}/></span></footer>}
      </div>
    </main>
    {detail && <div className="modal-backdrop" onClick={() => setDetail(null)}><section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" onClick={e => e.stopPropagation()}><button autoFocus className="icon-button modal-close" aria-label="关闭模板详情" onClick={() => setDetail(null)}><X size={20}/></button><TemplateArt tone={detail.tone}/><div className="detail-content"><span className="section-number">示例模板 / {detail.industry.toUpperCase()}</span><h2 id="detail-title">{detail.name}</h2><p>{detail.description}</p><div className="detail-meta"><div><span>任务</span><strong>{detail.task}</strong></div><div><span>建议比例</span><strong>{detail.ratio}</strong></div><div><span>参考图</span><strong>可选</strong></div></div><p><strong>提示词结构：</strong> {detail.fields.map(field => `[${field.label}]`).join('、')}。</p><p className="detail-note">这是未经测试的提示词示例。展示的画面仅作装饰，并非生成结果。使用前可以查看和编辑提示词。</p><button className="dark-button" onClick={() => start(detail)}>使用模板 <ArrowRight size={16}/></button></div></section></div>}
  </div>;
}

function TemplateCard({ template, index, onOpen }: { template: Template; index: number; onOpen: () => void }) {
  return <button className="template-card" onClick={onOpen}><TemplateArt tone={template.tone}/><div className="card-content"><div className="card-meta"><span>{template.industry.toUpperCase()} / {template.task.toUpperCase()}</span><span>0{index + 1}</span></div><div className="card-title"><h3>{template.name}</h3><ArrowUpRight size={18}/></div><p>{template.description}</p><span className="card-link">查看模板 <ArrowDown size={12}/></span></div></button>;
}
