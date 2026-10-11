import { documentSchema, type StoreDocument, type DesignNode, type DesignStyle } from "./document.js";
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function css(style: DesignStyle): string {
  return Object.entries(style).map(([key, value]) => {
    if (key === "columns") return `grid-template-columns:repeat(${value},minmax(0,1fr))`;
    const property = key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
    return `${property}:${value}${typeof value === "number" ? "px" : ""}`;
  }).join(";");
}
export function renderDocument(input: StoreDocument, options: { path?: string; preview?: boolean; origin?: string; nonce?: string } = {}): string {
  const doc = documentSchema.parse(input), page = doc.pages.find(p => p.path === (options.path || "/"));
  if (!page) throw new Error("Página no encontrada");
  const style: string[] = [], mobile: string[] = [];
  const content = page.blocks.filter(b => b.visible).map(block => {
    function render(node: DesignNode): string {
      style.push(`[data-node-id="${node.id}"]{${css(node.style)}}`); mobile.push(`[data-node-id="${node.id}"]{${css(node.mobile)}}`);
      const attributes = ` data-node-id="${node.id}" data-block-id="${block.id}"`;
      if (node.tag === "img") return `<img${attributes} src="${escape(node.src || "")}" alt="${escape(node.alt || "")}" loading="lazy" decoding="async">`;
      return `<${node.tag}${attributes}${node.tag === "a" ? ` href="${escape(node.href || "#")}"` : ""}>${escape(node.text)}${block.nodes.filter(n => n.parentId === node.id).map(render).join("")}</${node.tag}>`;
    }
    return `<section data-block="${block.id}" class="block ${block.type}">${block.nodes.filter(n => !n.parentId).map(render).join("")}</section>`;
  }).join("");
  const bridge = options.preview ? `<script nonce="${escape(options.nonce || "")}">
    let selected;document.addEventListener('click',event=>{const el=event.target.closest('[data-node-id]');if(el){event.preventDefault();event.stopPropagation();if(selected)selected.removeAttribute('data-selected');selected=el;el.setAttribute('data-selected','true');parent.postMessage({type:'horizon:select',nodeId:el.dataset.nodeId},'*')}else{const a=event.target.closest('a');if(a){event.preventDefault();parent.postMessage({type:'horizon:navigate',path:new URL(a.href,location.href).pathname},'*')}}},true);
    parent.postMessage({type:'horizon:ready'},'*');
  </script>` : "";
  const canonical = options.origin ? `<link rel="canonical" href="${escape(options.origin.replace(/\/$/, "") + page.path)}">` : "";
  return `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(page.title)}</title><meta name="description" content="${escape(page.description)}">${canonical}<meta name="robots" content="${options.preview ? "noindex,nofollow" : "index,follow"}"><style>
    *{box-sizing:border-box}body{margin:0;background:${doc.brand.background};color:${doc.brand.foreground};font-family:Arial,sans-serif;line-height:1.6}header,footer{padding:24px 6%;display:flex;justify-content:space-between;border-bottom:1px solid #8883}a{color:inherit}header a{text-decoration:none;font-weight:700}nav{display:flex;gap:22px;font-size:13px}.block{padding:64px 8%}.hero{min-height:62vh;padding-top:86px}h1,h2,h3{line-height:1.08;letter-spacing:-.045em;margin:20px 0}p{max-width:720px}img{max-width:100%;height:auto}.hero>a{display:inline-block;background:${doc.brand.accent};color:${doc.brand.background};padding:14px 24px;margin-top:18px;border-radius:4px;text-decoration:none}footer{font-size:12px;border-top:1px solid #8883}.content{border-top:1px solid #8883}[data-selected]{outline:2px solid #7562d9!important;outline-offset:5px}${options.preview ? '[data-node-id]:hover{outline:1px dashed #7562d9;outline-offset:4px;cursor:crosshair}' : ''}
    ${style.join("\n")}@media(max-width:640px){.block{padding:40px 6%}.hero{min-height:55vh}nav{gap:12px}${mobile.join("\n")}}
    </style></head><body><header><a href="/">${escape(doc.brand.name)}</a><nav>${doc.pages.map(p => `<a href="${p.path}">${escape(p.path === "/" ? "Inicio" : p.title)}</a>`).join("")}<a href="/checkout/">Carrito</a></nav></header><main>${content}</main><footer><span>${escape(doc.brand.name)}</span><span>Argentina · ARS</span></footer>${bridge}</body></html>`;
}
