import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { apiSettings, fetchImageModels, saveApiSettings } from './image-api';
import { DEFAULT_IMAGE_MODELS } from './image-models';

export function ImageApiSettings() {
  const [url, setUrl] = useState('https://api.apikey.fan/v1');
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>(DEFAULT_IMAGE_MODELS);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [searched, setSearched] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const allModels = useMemo(() => [...new Set([...availableModels, ...selectedModels])], [availableModels, selectedModels]);
  const filtered = allModels.filter(model => model.toLowerCase().includes(searched.trim().toLowerCase()));
  useEffect(() => { apiSettings().then(data => { setUrl(data.apiUrl); setHasKey(data.hasKey); setSelectedModels(data.selectedModels); setAvailableModels(data.availableModels); }).catch(error => setMessage(error.message)); }, []);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { const data = await saveApiSettings({ apiUrl: url, apiKey: key, selectedModels, availableModels }); setUrl(data.apiUrl); setHasKey(data.hasKey); setKey(''); setSelectedModels(data.selectedModels); setAvailableModels(data.availableModels); setMessage('设置与模型选择已保存。'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '保存失败。'); } finally { setBusy(false); }
  }
  async function clear() {
    setBusy(true); setMessage('');
    try { const data = await saveApiSettings({ apiUrl: url, clearKey: true, selectedModels, availableModels }); setHasKey(data.hasKey); setKey(''); setMessage('API Key 已清除，模型选择已保存。'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '清除失败。'); } finally { setBusy(false); }
  }
  async function probe(loadModels: boolean) {
    setBusy(true); setMessage('');
    try {
      const models = await fetchImageModels({ apiUrl: url, apiKey: key });
      if (loadModels) { setAvailableModels(models); setMessage(`已获取 ${models.length} 个模型，请选择图片模型并保存设置。`); }
      else setMessage(`联通成功：模型列表接口返回 ${models.length} 个模型。此测试未验证生图权限。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : '连接失败。'); }
    finally { setBusy(false); }
  }
  function toggle(model: string) { setSelectedModels(current => current.includes(model) ? current.filter(item => item !== model) : [...current, model]); }
  return <section className="account-page image-settings"><span className="section-number">设置 / 图片服务</span><h1>连接你的<em>创作工具。</em></h1><p>配置服务并选择模型，创作页只显示启用的模型。</p><form className="account-card" onSubmit={save}>
    <h2>图片 API</h2><p className="settings-intro">密钥以明文保存在本机服务端配置文件中，不会显示在页面上。请仅在可信的个人电脑上使用。</p>
    <label className="field">API URL<input type="url" value={url} onChange={e => setUrl(e.target.value)} required placeholder="https://api.apikey.fan/v1" autoComplete="url"/><small>填写 /v1 基础地址，也可粘贴图片接口完整地址。</small></label>
    <label className="field">API Key <span>{hasKey ? '已配置' : '未配置'}</span><input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={hasKey ? '留空保留当前密钥' : '输入 API Key'} autoComplete="off"/></label>
    <div className="settings-actions"><button className="outline-button" type="button" disabled={busy} onClick={() => void probe(false)}>测试联通</button><button className="outline-button" type="button" disabled={busy} onClick={() => void probe(true)}>获取模型</button></div>
    <p className="settings-intro">测试和获取模型会使用当前填写的地址与密钥；密钥留空时使用已保存的密钥。两者均调用模型列表接口，不发起生图。</p>
    {message && <p role="status" className="settings-message">{message}</p>}
    <div className="model-settings"><div className="model-settings-heading"><div><h3>启用模型</h3><p>已选择 {selectedModels.length} 个 · 请选择支持图片生成或编辑的模型</p></div></div>
      <label className="field">搜索模型<input value={searched} onChange={e => setSearched(e.target.value)} placeholder="输入模型名称"/></label>
      <div className="model-selection-actions"><button type="button" disabled={busy || !filtered.length} onClick={() => setSelectedModels(current => [...new Set([...current, ...filtered])])}>全选当前列表</button><button type="button" disabled={busy || !selectedModels.length} onClick={() => setSelectedModels([])}>清空选择</button></div>
      <div className="model-checklist">{filtered.length ? filtered.map(model => <label className="model-option" key={model}><input type="checkbox" checked={selectedModels.includes(model)} onChange={() => toggle(model)}/><span>{model}</span>{availableModels.length > 0 && !availableModels.includes(model) && <small>列表未返回</small>}</label>) : <p className="model-empty">{allModels.length ? '没有匹配的模型。' : '还没有模型，请先获取模型。'}</p>}</div>
      <p className="settings-note">接口返回的列表可能包含文本等其他类型，也可能不完整；请根据服务商说明选择图片模型。模型选择不会自动验证生图权限。</p>
    </div>
    <div className="settings-actions"><button className="dark-button" type="submit" disabled={busy}>保存设置</button>{hasKey && <button className="outline-button" type="button" disabled={busy} onClick={() => void clear()}>清除密钥</button>}</div>
    <p className="settings-note">发送生成或编辑请求会使用你的 API 额度。</p>
  </form></section>;
}
