# Prompt — Horizon Control Admin (Claude Design / Stitch)

Copy everything below the line into Claude Design or Stitch.

---

Desktop 1440×900, web app (no landing). Una sola pantalla: **ops console** de una marca de ropa deportiva argentina. El producto es el storefront vivo; el chrome es un rail de control. Español Río de la Plata, corto.

**Tesis:** “Camarín + monitor de pista”: el sitio ocupa casi todo; la UI de ops es un marco violeta/crema, denso, sin mosaico de cards.

**Rechazar:** dark mode lima, Segoe/Inter default, sidebar azul SaaS, 8 metric cards con icono a la izquierda, glassmorphism, gradientes decorativos, purple-on-black crypto, “Admin” enorme.

**DESIGN SYSTEM (REQUIRED):**
- Platform: Web, desktop-first (1440×900), also 390×844 stacked
- Theme: Light, athletic-luxury, quiet. Same world as horizonfit.com.ar
- Background: Warm cream (#fbf3e8)
- Surface: Paper (#fffdf9)
- Surface strong: Sand (#f8ecdd)
- Primary: Horizon violet (#35006d) — logo, active nav, primary buttons
- Primary strong: Night indigo (#1a1054) — header wordmark
- Announce strip: Deep purple (#320a5c) — 34px top rail like the store marquee (one line of status, not marketing slogans)
- Text: Near black (#0b0b0f)
- Muted: rgba(11,11,15,0.64)
- Border: rgba(11,11,15,0.12) — whisper, not #2a332c slabs
- Radius: 14px controls, 24px site viewport frame (not 8px everywhere)
- Type: Display/UI “Archivo” or “Blauer Neue”-like geometric grotesque, 500/700. Data/SKU: tabular, slightly smaller. No Segoe UI.
- Depth: Surface tints + 1 hairline. No drop shadows except the site frame (`0 18px 50px rgba(0,0,0,0.08)`).
- Accent usage: ONE violet. Success/warn/error desaturated, not neon lime/red.

**Signature (must appear 5 times):** a **studio monitor** — the live site sits in a large rounded viewport with a thin URL rail (home / PDP Top azul / open). Navigation is a quiet text rail under a 76px header (logo mark + “Horizon Control” + store “Horizon Fit” + Entrar). Chat is a paper inspector on the right (320–360px), same cream as canvas, not a second “app”.

**Page Structure (single artboard, labeled regions):**
1. **Announce (34px):** left: storefront status “horizonfit.com.ar · 200”; right: “Tailscale · sin sesión”. Deep purple, white type, 12px.
2. **Header (76px):** isotipo/wordmark violet, store chip “Horizon Fit”, ghost “Entrar”. No giant H1 “Admin”.
3. **Nav rail:** text links Sitio (active underline violet), Salud, Catálogo, Ventas, Woo, Alertas. Not pill buttons.
4. **Workspace 1fr + 340px:**
   - **Sitio (default):** URL field + Home + Top azul + “Nueva pestaña”. Below: huge iframe placeholder of a fashion PDP (top azul, cream page) filling remaining height. Caption 12px muted: “Vista del storefront. wp-admin se abre desde Woo.”
   - **Inspector Consulta:** title “Consulta”, 2–3 chat bubbles (Q: precio 001-TOP-AZU / A: Top Dynamic blue · $67.000 ARS), input + “Preguntar”. Not a black `<pre>` dump.
5. **Ghost states (small thumbnails or notes on the same board, not extra pages):** Salud = 3 inline stats (Storefront / API / Repo) as labeled numbers, not a card grid. Catálogo = one SKU row with name + $67.000. Woo = currency ARS + link wp-admin. Alertas = one warning line.

**Copy (use exactly):** Horizon Control · Horizon Fit · Sitio · Salud · Catálogo · Ventas · Woo · Alertas · Consulta · Entrar · Home · Top azul · “¿Cuál es el precio del SKU 001-TOP-AZU?”

**Output:** one high-fidelity desktop frame + one mobile stack (site on top, chat below). No extra marketing landing. No fake analytics charts.
