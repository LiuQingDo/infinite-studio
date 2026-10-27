import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const preview = path.resolve(root, '..', 'infinite-studio-reference-preview')
const canvas = path.join(preview, 'infinite-canvas', 'web')
const toon = path.join(preview, 'Toonflow-app')
const bun = path.join(preview, 'runtime', 'node_modules', 'bun', 'bin', 'bun.exe')
const node = process.execPath
const toonEnv = { ...process.env, NODE_ENV: 'dev', TOONFLOW_SERVER_PORT: '5191' }
const services = [
  { name: 'Studio API', cwd: path.join(root, 'apps', 'api'), executable: node, script: 'node_modules/wrangler/bin/wrangler.js', args: ['dev', '--port', '8787'], port: 8787 },
  { name: 'Studio', cwd: path.join(root, 'apps', 'web'), executable: node, script: 'node_modules/vite/bin/vite.js', args: ['--host', '127.0.0.1', '--port', '5173', '--strictPort'], port: 5173 },
  { name: 'Infinite Canvas', cwd: canvas, executable: node, script: 'node_modules/vite/bin/vite.js', args: ['--host', '127.0.0.1', '--port', '5180', '--strictPort'], port: 5180 },
  { name: 'Toonflow API', cwd: toon, executable: bun, script: 'apps/server/src/index.ts', args: [], env: toonEnv, port: 5191 },
  { name: 'Toonflow', cwd: path.join(toon, 'apps', 'web'), executable: node, script: 'node_modules/vite/bin/vite.js', args: ['--host', '127.0.0.1', '--port', '5181', '--strictPort'], env: toonEnv, port: 5181 },
]

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
  })
}

const missing = services.flatMap((service) => [service.executable, path.resolve(service.cwd, service.script)])
  .filter((file) => !existsSync(file))
if (missing.length) {
  console.error('缺少启动文件或依赖，请先按开发与运行说明准备本项目及参考项目预览环境：')
  for (const file of new Set(missing)) console.error(`  ${file}`)
  process.exit(1)
}
const availability = await Promise.all(services.map((service) => checkPort(service.port)))
const busy = services.filter((_, i) => !availability[i])
if (busy.length) {
  console.error('以下端口已被占用，请先关闭相应服务后重试：')
  for (const service of busy) console.error(`  ${service.name}: ${service.port}`)
  process.exit(1)
}

console.log('正在启动，首次加载可能需要一些时间：')
console.log('  Infinite Studio  http://127.0.0.1:5173')
console.log('  Infinite Canvas  http://127.0.0.1:5180')
console.log('  Toonflow         http://127.0.0.1:5181')
console.log('按 Ctrl+C 停止本次启动的所有服务。\n')

const children = []
let stopping = false
function stop(code) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
    } else {
      child.kill('SIGTERM')
    }
  }
  process.exit(code)
}
for (const service of services) {
  const child = spawn(service.executable, [path.resolve(service.cwd, service.script), ...service.args], {
    cwd: service.cwd, env: service.env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  })
  children.push(child)
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (data) => process.stdout.write(`[${service.name}] ${data}`))
  }
  child.on('error', (error) => {
    console.error(`[${service.name}] 启动失败：${error.message}`)
    stop(1)
  })
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`[${service.name}] 已退出（${signal ?? code}），正在停止其他服务。`)
      stop(1)
    }
  })
}
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
