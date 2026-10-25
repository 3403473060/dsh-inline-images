/**
 * dsh-inline-images host:「对话显示图片」。
 *  - 图片回环路由 /plugins/dsh-inline-images/image?t=<token>&p=<path>(与 Web 页面同源)。
 *  - llm/stream 包装:把助手消息文本中的本地图片路径改写为该 URL → 产品 MarkdownText 在消息正文内渲染图片。
 *  - InlineImagesRuntime:Typert Remote 服务(getConfig / setConfig,控制正文图片最大尺寸)。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-credentials'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { TypertContribution } from '@deepseek-ai/dsh-typert-registry/types'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'

export const name = 'dsh-inline-images'
// typert:apply() 里通过 ctx.typert 注册 invocation manifest,必须声明依赖,
// 否则 fiber 可能在 typert 服务就绪前执行 apply。
export const inject = ['llm', 'typert']

const ROUTE_PATH = '/plugins/dsh-inline-images/image'
const REF_MAX_WIDTH = 'INLINE_IMAGE_MAX_WIDTH'
const REF_MAX_HEIGHT = 'INLINE_IMAGE_MAX_HEIGHT'
const IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'bmp', 'ico']

/* ---------- wire contract ---------- */
// codec 形状由 dsh-typert-registry 约定: { mode, typeSymbol, create: () => ZodType }。
// 直接给 `schema` 字段不会被识别,registry 物化 codec 时拿不到 schema。
const configSchema = z.object({ maxWidth: z.number(), maxHeight: z.number(), formats: z.array(z.string()) }).readonly()
const setConfigArgsSchema = z.object({ maxWidth: z.number().optional(), maxHeight: z.number().optional() })
export const INLINE_INVOCATIONS: readonly InvocationDescriptor[] = [
  { id: 'dsh-inline-images#inlineImages/getConfig', service: 'inlineImages', namespace: 'inlineImages', method: 'getConfig', invocation: { kind: 'direct' },
    parameters: [], result: { mode: 'strict', typeSymbol: 'dsh-inline-images#Config', create: () => configSchema } },
  { id: 'dsh-inline-images#inlineImages/setConfig', service: 'inlineImages', namespace: 'inlineImages', method: 'setConfig', invocation: { kind: 'direct' },
    parameters: [{ name: 'args', wire: 'args', source: 'argument', codec: { mode: 'strict', typeSymbol: 'dsh-inline-images#SetConfigArgs', create: () => setConfigArgsSchema } }],
    result: { mode: 'strict', typeSymbol: 'dsh-inline-images#Config', create: () => configSchema } },
]

export const INLINE_MANIFEST: TypertContribution = {
  package: 'dsh-inline-images',
  face: 'host',
  schemas: [],
  model: {
    services: [{
      key: 'inlineImages',
      exportName: 'InlineImagesRuntime',
      description: '对话内联图片的尺寸配置端点。',
      tags: [],
      members: [
        { kind: 'method', name: 'getConfig', signature: 'getConfig(): Promise<Config>' },
        { kind: 'method', name: 'setConfig', signature: 'setConfig(args: SetConfigArgs): Promise<Config>' },
      ],
      types: [],
    }],
    events: [],
    objects: [],
  },
  invocations: INLINE_INVOCATIONS,
}

function mediaTypeFor(path: string): string | null {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.avif')) return 'image/avif'
  if (lower.endsWith('.bmp')) return 'image/bmp'
  if (lower.endsWith('.ico')) return 'image/x-icon'
  return null
}

/** Remote service:正文图片最大尺寸配置。 */
export class InlineImagesRuntime extends TypertRemoteService {
  private readonly credentials: Context['credentials'] | undefined

  constructor(ctx: Context) {
    super(ctx, 'inlineImages')
    this.credentials = ctx.get('credentials')
  }

  async getConfig() {
    const read = async (ref: string, fallback: number): Promise<number> => {
      if (this.credentials === undefined) return fallback
      try {
        const resolved = await this.credentials.resolve(ref as never)
        if (resolved === undefined) return fallback
        const value = Number(resolved.value)
        return Number.isFinite(value) && value >= 64 ? Math.round(value) : fallback
      } catch {
        return fallback
      }
    }
    return {
      maxWidth: await read(REF_MAX_WIDTH, 640),
      maxHeight: await read(REF_MAX_HEIGHT, 420),
      formats: IMAGE_FORMATS,
    }
  }

  async setConfig(args: { maxWidth?: number; maxHeight?: number }) {
    if (this.credentials === undefined) throw new Error('凭证服务不可用,无法保存配置')
    if (typeof args.maxWidth === 'number') {
      const value = Math.round(args.maxWidth)
      if (!(value >= 64 && value <= 2400)) throw new Error('宽度需在 64-2400 之间')
      await this.credentials.set(REF_MAX_WIDTH as never, String(value))
    }
    if (typeof args.maxHeight === 'number') {
      const value = Math.round(args.maxHeight)
      if (!(value >= 64 && value <= 2400)) throw new Error('高度需在 64-2400 之间')
      await this.credentials.set(REF_MAX_HEIGHT as never, String(value))
    }
    return this.getConfig()
  }
}

/* ---------- 路径扫描(与动态版一致) ---------- */
const BARE_STOP = "\\s'\"<>\\[\\]\u3001\uFF0C\u3002\uFF1B;`"
const PLACEHOLDER_SEGMENT = /^(路径|示例|占位|本地路径|某某|xx|xxx)$/i
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i

function normalizeCandidate(raw: string): string {
  let value = raw.trim()
  value = value.replace(/^['"`\[(\s]+/, '')
  value = value.replace(/['"`]+$/, '')
  value = value.replace(/[\]}>]+$/, '')
  value = value.replace(/[;,，。、.]+$/, '')
  return value.trim()
}

function acceptable(path: string): boolean {
  if (path.length < 3) return false
  if (/^(https?:|data:|file:|mailto:)/i.test(path)) return false
  if (!IMAGE_EXT_RE.test(path)) return false
  if (!/^([A-Za-z]:[\\/]|\\\\|\/)/.test(path)) return false
  if (path.split(/[\\/]/).some(segment => PLACEHOLDER_SEGMENT.test(segment))) return false
  return true
}

function scanImagePathRanges(text: string): Array<{ path: string; rawStart: number; rawEnd: number }> {
  const found: Array<{ path: string; rawStart: number; rawEnd: number }> = []
  const seen = new Set<string>()
  const push = (raw: string, start: number, end: number) => {
    const path = normalizeCandidate(raw)
    if (!acceptable(path)) return
    if (seen.has(path)) return
    seen.add(path)
    found.push({ path, rawStart: start, rawEnd: end })
  }
  const mdRe = /!?\[[^\]]*\]\(\s*([^)\s][^)]*?)\s*\)/g
  let match: RegExpExecArray | null
  while ((match = mdRe.exec(text)) !== null) {
    const inner = match[1].trim()
    const quote = inner[0]
    const path = quote === '"' || quote === "'"
      ? (inner.indexOf(quote, 1) !== -1 ? inner.slice(1, inner.indexOf(quote, 1)) : inner)
      : inner
    push(path, match.index, match.index + match[0].length)
  }
  const bareRe = new RegExp('(?:[A-Za-z]:[\\\\/][^' + BARE_STOP + ']+|\\\\[^\\\\\\s]+[\\\\/][^' + BARE_STOP + ']+|\\/[^' + BARE_STOP + ']+)', 'g')
  while ((match = bareRe.exec(text)) !== null) {
    const path = normalizeCandidate(match[0])
    if (!acceptable(path)) continue
    let start = match.index
    let end = match.index + match[0].length
    if (text[start - 1] === '`' && text[end] === '`') {
      start -= 1
      end += 1
    }
    if (seen.has(path)) continue
    seen.add(path)
    found.push({ path, rawStart: start, rawEnd: end })
  }
  return found
}

export function apply(ctx: Context): void {
  const fs = ctx.get('fs')
  const attachments = ctx.get('attachments')
  const webServer = ctx.get('webServer')
  const llm = ctx.get('llm')
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)

  // Remote 服务:apply 会在 fiber 重放(插件热重载、依赖变更)时再次执行,
  // 而服务已在首次执行时 provide 过,重复 provide 会抛 `has been registered`。
  const runtime = new InlineImagesRuntime(ctx)
  if (ctx.get('inlineImages') === undefined) {
    try {
      ctx.provide('inlineImages', runtime as never)
    } catch (error) {
      if (!String((error as { message?: string } | undefined)?.message ?? error).includes('has been registered')) throw error
    }
  }
  ctx.effect(() => {
    const typert = ctx.get('typert')
    if (typert === undefined) {
      console.error('[dsh-inline-images] typert 服务不可用,跳过 Remote manifest 注册')
      return
    }
    try {
      const dispose = (typert as any).register(INLINE_MANIFEST)
      return () => { void dispose() }
    } catch (error) {
      // 生成物非法(例如 codec 缺 create())必须可见,否则整条 entry 会静默失效。
      console.error('[dsh-inline-images] typert manifest 注册失败:', error)
      throw error
    }
  }, 'dsh-inline-images: typert manifest')

  // 图片回环路由
  if (webServer !== undefined && fs !== undefined) {
    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: ROUTE_PATH,
      async handler(req: any, res: any) {
        try {
          const raw = String(req.url ?? '')
          const at = raw.indexOf('?')
          const query: Record<string, string> = {}
          if (at !== -1) {
            for (const pair of raw.slice(at + 1).split('&')) {
              const eq = pair.indexOf('=')
              if (eq === -1) continue
              try { query[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' ')) } catch { /* skip */ }
            }
          }
          if (query.t !== token || !query.p) {
            res.writeHead(400); res.end('bad request'); return
          }
          const mediaType = mediaTypeFor(query.p)
          if (mediaType === null) {
            res.writeHead(400); res.end('not an image path'); return
          }
          let maxBytes = 20 * 1024 * 1024
          if (attachments !== undefined) {
            try { maxBytes = attachments.imageLimits.maxImageBytes } catch { /* keep default */ }
          }
          const target = await fs.resolve(query.p)
          const bytes = await fs.readBytes(target, undefined, maxBytes)
          res.writeHead(200, { 'Content-Type': mediaType, 'Cache-Control': 'private, max-age=60' })
          res.end(bytes)
        } catch {
          try { res.writeHead(404); res.end('not found') } catch { /* dropped */ }
        }
      },
    }), 'dsh-inline-images: image route')
  }

  // llm/stream 包装
  if (llm !== undefined && webServer !== undefined) {
    ctx.on('llm/stream', (options: any, next: any) => {
      if (options?.purpose) return next()
      return rewriteStream(next, webServer.port, token, fs)
    })
  }

  void runtime
}

async function* rewriteStream(next: any, port: number, token: string, fs: Context['fs']) {
  const seenPaths = new Set<string>()
  for await (const chunk of next()) {
    if (chunk?.type === 'block-end' && chunk.block?.type === 'text' && typeof chunk.block.text === 'string') {
      try {
        const text = chunk.block.text
        const ranges = scanImagePathRanges(text)
        if (ranges.length > 0 && fs !== undefined) {
          let rewritten = text
          let changed = false
          const todo: Array<{ range: any; url: string }> = []
          for (const range of ranges) {
            if (seenPaths.has(range.path)) continue
            seenPaths.add(range.path)
            try {
              const target = await fs.resolve(range.path)
              const info = await fs.stat(target)
              if (info === undefined || info.type !== 'file') continue
            } catch {
              continue
            }
            todo.push({ range, url: 'http://127.0.0.1:' + port + ROUTE_PATH + '?t=' + token + '&p=' + encodeURIComponent(range.path) })
          }
          todo.sort((a, b) => b.range.rawStart - a.range.rawStart)
          for (const { range, url } of todo) {
            const before = rewritten
            rewritten = rewritten.slice(0, range.rawStart) + '![](' + url + ')' + rewritten.slice(range.rawEnd)
            if (rewritten !== before) changed = true
          }
          if (changed) {
            yield { ...chunk, block: { ...chunk.block, text: rewritten } }
            continue
          }
        }
      } catch (error) {
        console.error('[dsh-inline-images] 图片路径改写失败:', error)
      }
    }
    yield chunk
  }
}
