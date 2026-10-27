import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient, type Session } from '@supabase/supabase-js';
import { Background, Controls, ReactFlow, type Node } from '@xyflow/react';
import { ArrowUpRight, Circle, Layers3, MoveUpRight, Sparkles } from 'lucide-react';
import type { ImageTask, ServiceStatus, TaskStatus } from '@infinite-studio/contracts';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = url && key ? createClient(url, key) : null;
const nodes: Node[] = [{ id: 'start', position: { x: 0, y: 0 }, data: { label: '从这里开始创作' }, draggable: true }];
const taskLabels: Record<TaskStatus, string> = { queued: '排队中', submitting: '提交中', running: '生成中', succeeded: '已完成', failed: '失败', unknown: '状态待确认' };

async function readJson<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!response.ok) throw new Error('服务暂不可用');
  return response.json() as Promise<T>;
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const status = useQuery({ queryKey: ['status'], queryFn: () => readJson<ServiceStatus>('/api/status'), retry: false });
  const tasks = useQuery({ queryKey: ['tasks', session?.user.id], queryFn: () => readJson<{ tasks: ImageTask[] }>('/api/tasks', session!.access_token), enabled: Boolean(session), retry: false });
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);
  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setPassword('');
    setMessage(error ? '登录失败，请检查账号信息后重试。' : '');
  }
  const service = status.isError ? '服务未连接' : status.isPending ? '正在检查连接' : '工作区已连接';
  return (
    <div className="app-shell">
      <aside className="rail" aria-label="工作区导航">
        <a className="brand" href="/" aria-label="Infinite Studio 首页"><span className="brand-mark">∞</span><span>infinite<br /><b>studio</b></span></a>
        <div className="rail-section">工作空间</div>
        <div className="rail-item selected"><Layers3 size={17} /> 创作空间 <span>01</span></div>
        <div className="rail-footer"><span className="status-dot" /> {service}</div>
      </aside>
      <main className="main">
        <header className="topbar"><span>你的创作空间 <span className="slash">/</span> 画布</span><span className="top-right">图片创作 <MoveUpRight size={14} /></span></header>
        <div className="content">
          <div className="heading"><div><div className="eyebrow"><span /> 为灵感留一片空间</div><h1>让想法<br /><em>自由生长。</em></h1><p>在这里整理灵感，开启你的下一次视觉创作。</p></div><span className="heading-index">01 — 03</span></div>
          <div className="workspace">
            <section className="canvas-panel" aria-labelledby="canvas-title">
              <div className="panel-top"><div><span className="panel-kicker">创作画布</span><h2 id="canvas-title">给灵感一点空间。</h2></div><span className="badge"><Circle size={8} fill="currentColor" /> 预览</span></div>
              <div className="canvas"><ReactFlow defaultNodes={nodes} fitView minZoom={0.4} maxZoom={1.5} ariaLabelConfig={{ 'controls.ariaLabel': '画布控制', 'controls.zoomIn.ariaLabel': '放大', 'controls.zoomOut.ariaLabel': '缩小', 'controls.fitView.ariaLabel': '适应画布', 'node.a11yDescription.default': '按回车键选择节点，使用方向键移动，按退格键删除。', 'node.a11yDescription.keyboardDisabled': '节点', 'node.a11yDescription.ariaLiveMessage': ({ x, y }) => `节点位置：${x}，${y}` }} proOptions={{ hideAttribution: false }}><Background gap={22} size={1} color="#c9c8bd" /><Controls showInteractive={false} /></ReactFlow><div className="canvas-note">拖动画布探索 <ArrowUpRight size={13} /></div></div>
              <div className="panel-bottom"><span><Sparkles size={15} /> 图片生成即将开放</span><span>01 / 画布</span></div>
            </section>
            <aside className="side-panel">
              <div className="account"><div className="panel-kicker">我的账户</div><h2>{session ? '欢迎回来。' : '你的账户。'}</h2>
                {session ? <><p>已登录：{session.user.email}</p><button className="outline-button" onClick={() => void supabase?.auth.signOut()}>退出登录</button><div className="task-list"><strong>最近任务</strong>{tasks.isPending ? <p>加载中…</p> : tasks.isError ? <p>暂时无法获取任务。</p> : tasks.data?.tasks.length ? tasks.data.tasks.map(task => <p key={task.id}>{taskLabels[task.status] ?? '状态未知'} · {new Date(task.created_at).toLocaleDateString('zh-CN')}</p>) : <p>暂无任务。</p>}</div></> : supabase ? <form onSubmit={signIn}><label>邮箱<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label><label>密码<input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /></label><button className="dark-button" type="submit">登录 <ArrowUpRight size={16} /></button>{message && <p role="alert">{message}</p>}</form> : <><p>配置完成后，即可在此登录账户。</p><span className="subtle">账户尚未连接</span></>}
              </div>
              <div className="side-note"><span className="note-symbol">✳</span><div><strong>让创意慢慢成形。</strong><p>将参考素材、想法和图片汇聚在一起，延续每一次创作。</p></div></div>
            </aside>
          </div>
          <footer><span>INFINITE STUDIO</span><span>从一张空白画布开始&nbsp; ↗</span></footer>
        </div>
      </main>
    </div>
  );
}
