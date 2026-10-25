window.__ModuleLoader__.load({
	id: "dsh-inline-images",
	factory: (require) => {
		"use strict";
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.ts
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var import_react = __toESM(require("react"), 1);
var name = "dsh-inline-images";
var inject = ["slots"];
function el(type, props, ...children) {
  return import_react.default.createElement.apply(null, [type, props].concat(children));
}
var lightboxStore = {
  listeners: /* @__PURE__ */ new Set(),
  current: null,
  open(src, name2) {
    this.current = { src, name: name2 };
    for (const fn of [...this.listeners]) {
      try {
        fn();
      } catch {
      }
    }
  },
  close() {
    this.current = null;
    for (const fn of [...this.listeners]) {
      try {
        fn();
      } catch {
      }
    }
  },
  subscribe(fn) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
};
function useStore(s) {
  const [value, setValue] = import_react.default.useState(s.get());
  import_react.default.useEffect(() => s.subscribe(() => setValue(s.get())), []);
  return value;
}
function ImageLightbox() {
  const current = useStore({ subscribe: lightboxStore.subscribe.bind(lightboxStore), get: () => lightboxStore.current });
  if (current === null) return null;
  return el(
    "div",
    {
      style: { position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.82)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, cursor: "zoom-out" },
      onClick: () => lightboxStore.close()
    },
    el("img", { src: current.src, alt: current.name, style: { maxWidth: "92vw", maxHeight: "78vh", objectFit: "contain", borderRadius: 6 }, onClick: (e) => e.stopPropagation() }),
    el("div", { style: { color: "#fff", fontSize: 13, opacity: 0.9 } }, current.name),
    el("button", { style: { padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(128,128,128,0.5)", background: "transparent", color: "#fff", cursor: "pointer" }, onClick: (e) => {
      e.stopPropagation();
      lightboxStore.close();
    } }, "\u5173\u95ED (Esc)")
  );
}
function InlineSettings(props) {
  const endpoint = props.ctx?.remote?.inlineImages;
  const [maxWidth, setMaxWidth] = import_react.default.useState(640);
  const [maxHeight, setMaxHeight] = import_react.default.useState(420);
  const [status, setStatus] = import_react.default.useState(null);
  import_react.default.useEffect(() => {
    if (endpoint === void 0) {
      applyImageSizes(640, 420);
      return;
    }
    let alive = true;
    endpoint.getConfig().then((cfg) => {
      if (!alive) return;
      setMaxWidth(cfg.maxWidth ?? 640);
      setMaxHeight(cfg.maxHeight ?? 420);
      applyImageSizes(cfg.maxWidth ?? 640, cfg.maxHeight ?? 420);
    }).catch(() => applyImageSizes(640, 420));
    return () => {
      alive = false;
    };
  }, [endpoint]);
  const save = () => {
    if (endpoint === void 0) return;
    setStatus(null);
    endpoint.setConfig({ args: { maxWidth: Number(maxWidth) || 640, maxHeight: Number(maxHeight) || 420 } }).then((cfg) => {
      setMaxWidth(cfg.maxWidth);
      setMaxHeight(cfg.maxHeight);
      applyImageSizes(cfg.maxWidth, cfg.maxHeight);
      setStatus({ kind: "ok", text: "\u6B63\u6587\u56FE\u7247\u6700\u5927\u5C3A\u5BF8\u5DF2\u66F4\u65B0\u4E3A " + cfg.maxWidth + "\xD7" + cfg.maxHeight });
    }).catch((err) => {
      setStatus({ kind: "err", text: "\u4FDD\u5B58\u5931\u8D25: " + String(err?.message ?? err) });
    });
  };
  const inputStyle = { width: 70, padding: "4px 8px", marginRight: 4 };
  const btnStyle = { padding: "6px 14px", cursor: "pointer" };
  return el(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 10, maxWidth: 640 } },
    el(
      "div",
      { style: { fontSize: 12, opacity: 0.7, lineHeight: 1.5 } },
      "LLM \u56DE\u590D\u4E2D\u5199\u51FA\u7684\u672C\u5730\u56FE\u7247\u8DEF\u5F84(\u5982 C:\\\u622A\u56FE\\a.png)\u4F1A\u5728\u6D88\u606F\u6B63\u6587\u91CC\u76F4\u63A5\u6E32\u67D3\u6210\u56FE\u7247\u3002\u53EF\u5728\u6B64\u8C03\u6574\u6B63\u6587\u56FE\u7247\u7684\u6700\u5927\u663E\u793A\u5C3A\u5BF8;\u70B9\u51FB\u6B63\u6587\u56FE\u7247\u53EF\u653E\u5927\u67E5\u770B\u539F\u56FE\u3002\u652F\u6301\u683C\u5F0F:png/jpg/jpeg/webp/gif/svg/avif/bmp/ico\u3002"
    ),
    endpoint === void 0 ? el(
      "div",
      { style: { fontSize: 12, opacity: 0.7 } },
      "\u5F53\u524D\u5BBF\u4E3B\u672A\u5411 Web \u5BA2\u6237\u7AEF\u66B4\u9732 inlineImages \u914D\u7F6E\u7AEF\u70B9,\u6B63\u6587\u56FE\u7247\u4F7F\u7528\u9ED8\u8BA4\u5C3A\u5BF8 640\xD7420\u3002"
    ) : el(
      "div",
      { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
      el("span", { style: { fontSize: 13 } }, "\u6B63\u6587\u56FE\u7247\u6700\u5927\u5C3A\u5BF8:"),
      el("input", { type: "number", min: 64, max: 2400, value: maxWidth, title: "\u5BBD\u5EA6 px", onChange: (e) => setMaxWidth(e.target.value), style: inputStyle }),
      el("span", null, "\xD7"),
      el("input", { type: "number", min: 64, max: 2400, value: maxHeight, title: "\u9AD8\u5EA6 px", onChange: (e) => setMaxHeight(e.target.value), style: inputStyle }),
      el("button", { style: btnStyle, onClick: save }, "\u5E94\u7528"),
      status ? el("span", { style: { fontSize: 12, color: status.kind === "ok" ? "#2e9e5b" : "#d64545" } }, status.text) : null
    )
  );
}
var styleTag = null;
function applyImageSizes(maxWidth, maxHeight) {
  if (typeof document === "undefined") return;
  if (styleTag === null) {
    styleTag = document.createElement("style");
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = 'img[src*="/plugins/dsh-inline-images/image"] { max-width: ' + maxWidth + "px !important; max-height: " + maxHeight + "px !important; object-fit: contain; border-radius: 8px; }";
}
function apply(ctx) {
  const slots = ctx.get("slots");
  if (slots === void 0) return;
  slots.inject("shell.overlay", () => slots.register(
    { name: "shell.overlay", id: "inline-images-lightbox", order: 100, label: "\u56FE\u7247\u706F\u7BB1" },
    () => import_react.default.createElement(ImageLightbox, null)
  ));
  slots.inject("settings.section", () => slots.register(
    { name: "settings.section", id: "inline-images", order: 35, label: "\u5185\u8054\u56FE\u7247" },
    (props) => import_react.default.createElement(InlineSettings, { ...props, ctx })
  ));
  if (typeof document !== "undefined") {
    const onClick = (event) => {
      const target = event.target;
      if (!target || target.tagName !== "IMG") return;
      const src = String(target.src ?? "");
      if (src.indexOf("/plugins/dsh-inline-images/image") === -1) return;
      event.preventDefault();
      event.stopPropagation();
      lightboxStore.open(src, target.alt || "\u56FE\u7247");
    };
    const onKey = (event) => {
      if (event.key === "Escape") lightboxStore.close();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    ctx.effect(() => () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      if (styleTag !== null && styleTag.parentNode !== null) styleTag.parentNode.removeChild(styleTag);
    });
  }
}
		return module.exports;
	}
});
//# sourceMappingURL=client.js.map
