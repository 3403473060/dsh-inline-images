/**
 * dsh-inline-images client:
 *  - shell.overlay 灯箱:点击消息正文中本插件渲染的图片放大;点背景或 Esc 关闭
 *  - 正文图片最大尺寸:设置 → 内联图片(经 ctx.remote.inlineImages 读写)
 *  - 尺寸 CSS 按配置注入 img[src*="/plugins/dsh-inline-images/image"]
 */
import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-slots'

export const name = 'dsh-inline-images'
// 只依赖 slots:客户端 Web 端的 `remote.<namespace>` 服务由
// @deepseek-ai/dsh-api-remotes 的 client bundle 静态挂载(该 bundle 内硬编码了一份
// host 能力清单),第三方插件的 namespace 不在其中,`remote.inlineImages` 恒不存在。
// 若把它写进 inject,插件会永久 pending(waiting for service),连灯箱与 CSS 一起失效,
// 因此这里只能在运行时探测,并在缺失时降级。
export const inject = ['slots']

function el(type: any, props: any, ...children: any[]) {
  return React.createElement.apply(null, [type, props].concat(children))
}

const lightboxStore = {
  listeners: new Set<() => void>(),
  current: null as { src: string; name: string } | null,
  open(src: string, name: string) {
    this.current = { src, name }
    for (const fn of [...this.listeners]) { try { fn() } catch { /* keep others */ } }
  },
  close() {
    this.current = null
    for (const fn of [...this.listeners]) { try { fn() } catch { /* keep others */ } }
  },
  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  },
}

function useStore<T>(s: { subscribe(fn: () => void): () => void; get(): T }): T {
  const [value, setValue] = React.useState<T>(s.get())
  React.useEffect(() => s.subscribe(() => setValue(s.get())), [])
  return value
}

function ImageLightbox() {
  const current = useStore({ subscribe: lightboxStore.subscribe.bind(lightboxStore), get: () => lightboxStore.current })
  if (current === null) return null
  return el('div', {
    style: { position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'zoom-out' },
    onClick: () => lightboxStore.close(),
  },
    el('img', { src: current.src, alt: current.name, style: { maxWidth: '92vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 6 }, onClick: (e: any) => e.stopPropagation() }),
    el('div', { style: { color: '#fff', fontSize: 13, opacity: 0.9 } }, current.name),
    el('button', { style: { padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(128,128,128,0.5)', background: 'transparent', color: '#fff', cursor: 'pointer' }, onClick: (e: any) => { e.stopPropagation(); lightboxStore.close() } }, '关闭 (Esc)')
  )
}

function InlineSettings(props: any) {
  // remote.inlineImages 在多数 Web 宿主上并不存在(见 inject 处说明),这里按可选端点处理:
  // 缺失时保留默认尺寸,面板给出说明而不是抛 TypeError。
  const endpoint = (props.ctx?.remote as any)?.inlineImages
  const [maxWidth, setMaxWidth] = React.useState(640)
  const [maxHeight, setMaxHeight] = React.useState(420)
  const [status, setStatus] = React.useState<{ kind: string; text: string } | null>(null)

  React.useEffect(() => {
    if (endpoint === undefined) {
      applyImageSizes(640, 420)
      return
    }
    let alive = true
    endpoint.getConfig().then((cfg: any) => {
      if (!alive) return
      setMaxWidth(cfg.maxWidth ?? 640)
      setMaxHeight(cfg.maxHeight ?? 420)
      applyImageSizes(cfg.maxWidth ?? 640, cfg.maxHeight ?? 420)
    }).catch(() => applyImageSizes(640, 420))
    return () => { alive = false }
  }, [endpoint])

  const save = () => {
    if (endpoint === undefined) return
    setStatus(null)
    endpoint.setConfig({ args: { maxWidth: Number(maxWidth) || 640, maxHeight: Number(maxHeight) || 420 } }).then((cfg: any) => {
      setMaxWidth(cfg.maxWidth)
      setMaxHeight(cfg.maxHeight)
      applyImageSizes(cfg.maxWidth, cfg.maxHeight)
      setStatus({ kind: 'ok', text: '正文图片最大尺寸已更新为 ' + cfg.maxWidth + '×' + cfg.maxHeight })
    }).catch((err: any) => {
      setStatus({ kind: 'err', text: '保存失败: ' + String(err?.message ?? err) })
    })
  }

  const inputStyle: React.CSSProperties = { width: 70, padding: '4px 8px', marginRight: 4 }
  const btnStyle: React.CSSProperties = { padding: '6px 14px', cursor: 'pointer' }

  return el('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 640 } },
    el('div', { style: { fontSize: 12, opacity: 0.7, lineHeight: 1.5 } },
      'LLM 回复中写出的本地图片路径(如 C:\\截图\\a.png)会在消息正文里直接渲染成图片。可在此调整正文图片的最大显示尺寸;点击正文图片可放大查看原图。支持格式:png/jpg/jpeg/webp/gif/svg/avif/bmp/ico。'
    ),
    endpoint === undefined
      ? el('div', { style: { fontSize: 12, opacity: 0.7 } },
        '当前宿主未向 Web 客户端暴露 inlineImages 配置端点,正文图片使用默认尺寸 640×420。'
      )
      : el('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
        el('span', { style: { fontSize: 13 } }, '正文图片最大尺寸:'),
        el('input', { type: 'number', min: 64, max: 2400, value: maxWidth, title: '宽度 px', onChange: (e: any) => setMaxWidth(e.target.value), style: inputStyle }),
        el('span', null, '×'),
        el('input', { type: 'number', min: 64, max: 2400, value: maxHeight, title: '高度 px', onChange: (e: any) => setMaxHeight(e.target.value), style: inputStyle }),
        el('button', { style: btnStyle, onClick: save }, '应用'),
        status ? el('span', { style: { fontSize: 12, color: status.kind === 'ok' ? '#2e9e5b' : '#d64545' } }, status.text) : null
      )
  )
}

let styleTag: HTMLStyleElement | null = null
function applyImageSizes(maxWidth: number, maxHeight: number) {
  if (typeof document === 'undefined') return
  if (styleTag === null) {
    styleTag = document.createElement('style')
    document.head.appendChild(styleTag)
  }
  styleTag.textContent = 'img[src*="/plugins/dsh-inline-images/image"] { max-width: ' + maxWidth + 'px !important; max-height: ' + maxHeight + 'px !important; object-fit: contain; border-radius: 8px; }'
}

export function apply(ctx: Context): void {
  const slots = ctx.get('slots')
  if (slots === undefined) return

  slots.inject('shell.overlay', () => slots.register(
    { name: 'shell.overlay', id: 'inline-images-lightbox', order: 100, label: '图片灯箱' },
    () => React.createElement(ImageLightbox, null),
  ))
  slots.inject('settings.section', () => slots.register(
    { name: 'settings.section', id: 'inline-images', order: 35, label: '内联图片' },
    (props: any) => React.createElement(InlineSettings, { ...props, ctx }),
  ))

  if (typeof document !== 'undefined') {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target || target.tagName !== 'IMG') return
      const src = String((target as HTMLImageElement).src ?? '')
      if (src.indexOf('/plugins/dsh-inline-images/image') === -1) return
      event.preventDefault()
      event.stopPropagation()
      lightboxStore.open(src, (target as HTMLImageElement).alt || '图片')
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') lightboxStore.close()
    }
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKey, true)
    ctx.effect(() => () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKey, true)
      if (styleTag !== null && styleTag.parentNode !== null) styleTag.parentNode.removeChild(styleTag)
    })
  }
}
