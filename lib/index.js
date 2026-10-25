// src/index.ts
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { z } from "zod";
var name = "dsh-inline-images";
var inject = ["llm", "typert"];
var ROUTE_PATH = "/plugins/dsh-inline-images/image";
var REF_MAX_WIDTH = "INLINE_IMAGE_MAX_WIDTH";
var REF_MAX_HEIGHT = "INLINE_IMAGE_MAX_HEIGHT";
var IMAGE_FORMATS = ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "bmp", "ico"];
var configSchema = z.object({ maxWidth: z.number(), maxHeight: z.number(), formats: z.array(z.string()) }).readonly();
var setConfigArgsSchema = z.object({ maxWidth: z.number().optional(), maxHeight: z.number().optional() });
var INLINE_INVOCATIONS = [
  {
    id: "dsh-inline-images#inlineImages/getConfig",
    service: "inlineImages",
    namespace: "inlineImages",
    method: "getConfig",
    invocation: { kind: "direct" },
    parameters: [],
    result: { mode: "strict", typeSymbol: "dsh-inline-images#Config", create: () => configSchema }
  },
  {
    id: "dsh-inline-images#inlineImages/setConfig",
    service: "inlineImages",
    namespace: "inlineImages",
    method: "setConfig",
    invocation: { kind: "direct" },
    parameters: [{ name: "args", wire: "args", source: "argument", codec: { mode: "strict", typeSymbol: "dsh-inline-images#SetConfigArgs", create: () => setConfigArgsSchema } }],
    result: { mode: "strict", typeSymbol: "dsh-inline-images#Config", create: () => configSchema }
  }
];
var INLINE_MANIFEST = {
  package: "dsh-inline-images",
  face: "host",
  schemas: [],
  model: {
    services: [{
      key: "inlineImages",
      exportName: "InlineImagesRuntime",
      description: "\u5BF9\u8BDD\u5185\u8054\u56FE\u7247\u7684\u5C3A\u5BF8\u914D\u7F6E\u7AEF\u70B9\u3002",
      tags: [],
      members: [
        { kind: "method", name: "getConfig", signature: "getConfig(): Promise<Config>" },
        { kind: "method", name: "setConfig", signature: "setConfig(args: SetConfigArgs): Promise<Config>" }
      ],
      types: []
    }],
    events: [],
    objects: []
  },
  invocations: INLINE_INVOCATIONS
};
function mediaTypeFor(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".ico")) return "image/x-icon";
  return null;
}
var InlineImagesRuntime = class extends TypertRemoteService {
  credentials;
  constructor(ctx) {
    super(ctx, "inlineImages");
    this.credentials = ctx.get("credentials");
  }
  async getConfig() {
    const read = async (ref, fallback) => {
      if (this.credentials === void 0) return fallback;
      try {
        const resolved = await this.credentials.resolve(ref);
        if (resolved === void 0) return fallback;
        const value = Number(resolved.value);
        return Number.isFinite(value) && value >= 64 ? Math.round(value) : fallback;
      } catch {
        return fallback;
      }
    };
    return {
      maxWidth: await read(REF_MAX_WIDTH, 640),
      maxHeight: await read(REF_MAX_HEIGHT, 420),
      formats: IMAGE_FORMATS
    };
  }
  async setConfig(args) {
    if (this.credentials === void 0) throw new Error("\u51ED\u8BC1\u670D\u52A1\u4E0D\u53EF\u7528,\u65E0\u6CD5\u4FDD\u5B58\u914D\u7F6E");
    if (typeof args.maxWidth === "number") {
      const value = Math.round(args.maxWidth);
      if (!(value >= 64 && value <= 2400)) throw new Error("\u5BBD\u5EA6\u9700\u5728 64-2400 \u4E4B\u95F4");
      await this.credentials.set(REF_MAX_WIDTH, String(value));
    }
    if (typeof args.maxHeight === "number") {
      const value = Math.round(args.maxHeight);
      if (!(value >= 64 && value <= 2400)) throw new Error("\u9AD8\u5EA6\u9700\u5728 64-2400 \u4E4B\u95F4");
      await this.credentials.set(REF_MAX_HEIGHT, String(value));
    }
    return this.getConfig();
  }
};
var BARE_STOP = "\\s'\"<>\\[\\]\u3001\uFF0C\u3002\uFF1B;`";
var PLACEHOLDER_SEGMENT = /^(路径|示例|占位|本地路径|某某|xx|xxx)$/i;
var IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i;
function normalizeCandidate(raw) {
  let value = raw.trim();
  value = value.replace(/^['"`\[(\s]+/, "");
  value = value.replace(/['"`]+$/, "");
  value = value.replace(/[\]}>]+$/, "");
  value = value.replace(/[;,，。、.]+$/, "");
  return value.trim();
}
function acceptable(path) {
  if (path.length < 3) return false;
  if (/^(https?:|data:|file:|mailto:)/i.test(path)) return false;
  if (!IMAGE_EXT_RE.test(path)) return false;
  if (!/^([A-Za-z]:[\\/]|\\\\|\/)/.test(path)) return false;
  if (path.split(/[\\/]/).some((segment) => PLACEHOLDER_SEGMENT.test(segment))) return false;
  return true;
}
function scanImagePathRanges(text) {
  const found = [];
  const seen = /* @__PURE__ */ new Set();
  const push = (raw, start, end) => {
    const path = normalizeCandidate(raw);
    if (!acceptable(path)) return;
    if (seen.has(path)) return;
    seen.add(path);
    found.push({ path, rawStart: start, rawEnd: end });
  };
  const mdRe = /!?\[[^\]]*\]\(\s*([^)\s][^)]*?)\s*\)/g;
  let match;
  while ((match = mdRe.exec(text)) !== null) {
    const inner = match[1].trim();
    const quote = inner[0];
    const path = quote === '"' || quote === "'" ? inner.indexOf(quote, 1) !== -1 ? inner.slice(1, inner.indexOf(quote, 1)) : inner : inner;
    push(path, match.index, match.index + match[0].length);
  }
  const bareRe = new RegExp("(?:[A-Za-z]:[\\\\/][^" + BARE_STOP + "]+|\\\\[^\\\\\\s]+[\\\\/][^" + BARE_STOP + "]+|\\/[^" + BARE_STOP + "]+)", "g");
  while ((match = bareRe.exec(text)) !== null) {
    const path = normalizeCandidate(match[0]);
    if (!acceptable(path)) continue;
    let start = match.index;
    let end = match.index + match[0].length;
    if (text[start - 1] === "`" && text[end] === "`") {
      start -= 1;
      end += 1;
    }
    if (seen.has(path)) continue;
    seen.add(path);
    found.push({ path, rawStart: start, rawEnd: end });
  }
  return found;
}
function apply(ctx) {
  const fs = ctx.get("fs");
  const attachments = ctx.get("attachments");
  const webServer = ctx.get("webServer");
  const llm = ctx.get("llm");
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const runtime = new InlineImagesRuntime(ctx);
  if (ctx.get("inlineImages") === void 0) {
    try {
      ctx.provide("inlineImages", runtime);
    } catch (error) {
      if (!String(error?.message ?? error).includes("has been registered")) throw error;
    }
  }
  ctx.effect(() => {
    const typert = ctx.get("typert");
    if (typert === void 0) {
      console.error("[dsh-inline-images] typert \u670D\u52A1\u4E0D\u53EF\u7528,\u8DF3\u8FC7 Remote manifest \u6CE8\u518C");
      return;
    }
    try {
      const dispose = typert.register(INLINE_MANIFEST);
      return () => {
        void dispose();
      };
    } catch (error) {
      console.error("[dsh-inline-images] typert manifest \u6CE8\u518C\u5931\u8D25:", error);
      throw error;
    }
  }, "dsh-inline-images: typert manifest");
  if (webServer !== void 0 && fs !== void 0) {
    ctx.effect(() => webServer.register({
      kind: "exact",
      path: ROUTE_PATH,
      async handler(req, res) {
        try {
          const raw = String(req.url ?? "");
          const at = raw.indexOf("?");
          const query = {};
          if (at !== -1) {
            for (const pair of raw.slice(at + 1).split("&")) {
              const eq = pair.indexOf("=");
              if (eq === -1) continue;
              try {
                query[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, " "));
              } catch {
              }
            }
          }
          if (query.t !== token || !query.p) {
            res.writeHead(400);
            res.end("bad request");
            return;
          }
          const mediaType = mediaTypeFor(query.p);
          if (mediaType === null) {
            res.writeHead(400);
            res.end("not an image path");
            return;
          }
          let maxBytes = 20 * 1024 * 1024;
          if (attachments !== void 0) {
            try {
              maxBytes = attachments.imageLimits.maxImageBytes;
            } catch {
            }
          }
          const target = await fs.resolve(query.p);
          const bytes = await fs.readBytes(target, void 0, maxBytes);
          res.writeHead(200, { "Content-Type": mediaType, "Cache-Control": "private, max-age=60" });
          res.end(bytes);
        } catch {
          try {
            res.writeHead(404);
            res.end("not found");
          } catch {
          }
        }
      }
    }), "dsh-inline-images: image route");
  }
  if (llm !== void 0 && webServer !== void 0) {
    ctx.on("llm/stream", (options, next) => {
      if (options?.purpose) return next();
      return rewriteStream(next, webServer.port, token, fs);
    });
  }
  void runtime;
}
async function* rewriteStream(next, port, token, fs) {
  const seenPaths = /* @__PURE__ */ new Set();
  for await (const chunk of next()) {
    if (chunk?.type === "block-end" && chunk.block?.type === "text" && typeof chunk.block.text === "string") {
      try {
        const text = chunk.block.text;
        const ranges = scanImagePathRanges(text);
        if (ranges.length > 0 && fs !== void 0) {
          let rewritten = text;
          let changed = false;
          const todo = [];
          for (const range of ranges) {
            if (seenPaths.has(range.path)) continue;
            seenPaths.add(range.path);
            try {
              const target = await fs.resolve(range.path);
              const info = await fs.stat(target);
              if (info === void 0 || info.type !== "file") continue;
            } catch {
              continue;
            }
            todo.push({ range, url: "http://127.0.0.1:" + port + ROUTE_PATH + "?t=" + token + "&p=" + encodeURIComponent(range.path) });
          }
          todo.sort((a, b) => b.range.rawStart - a.range.rawStart);
          for (const { range, url } of todo) {
            const before = rewritten;
            rewritten = rewritten.slice(0, range.rawStart) + "![](" + url + ")" + rewritten.slice(range.rawEnd);
            if (rewritten !== before) changed = true;
          }
          if (changed) {
            yield { ...chunk, block: { ...chunk.block, text: rewritten } };
            continue;
          }
        }
      } catch (error) {
        console.error("[dsh-inline-images] \u56FE\u7247\u8DEF\u5F84\u6539\u5199\u5931\u8D25:", error);
      }
    }
    yield chunk;
  }
}
export {
  INLINE_INVOCATIONS,
  INLINE_MANIFEST,
  InlineImagesRuntime,
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map
