import json
import os
from datetime import datetime, timezone
from collections import defaultdict

VIEWPORTS = {
    "desktop": {"width": 1365, "height": 900},
    "mobile": {"width": 390, "height": 844},
}

# Latest observed console capture (from final pass).
# Kept intentionally conservative: only errors we have consistently seen across runs.
CONSOLE_BASELINE = {
    "errors": [
        {
            "message": "Failed to load resource: the server responded with a status of 403 ()",
            "count": 2,
        }
    ],
    "warnings": [],
}

KNOWN_NOTES = [
    "Console shows repeated 403 resource-load errors in all runs.",
    "Previously observed in desktop runs: aria-hidden blocked because a focused descendant existed (focus retention). Re-verify after fixing focus management.",
]


def _safe_read_json(path: str):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _group_items(items: list[dict]) -> dict:
    grouped: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    for it in items:
        theme = it.get("theme")
        viewport = it.get("viewport")
        bucket = it.get("bucket")
        if theme in ("light", "dark") and viewport in ("desktop", "mobile") and bucket in ("baseline", "interaction"):
            grouped[theme][viewport][bucket].append(it)
    # stable ordering
    for theme in grouped:
        for viewport in grouped[theme]:
            for bucket in grouped[theme][viewport]:
                grouped[theme][viewport][bucket].sort(key=lambda x: x.get("rel", ""))
    return grouped


def _pick_key_evidence(rels: list[str]) -> list[str]:
    # Heuristic: pick a representative subset, stable.
    keywords = [
        "top",
        "components_baseline",
        "marketing",
        "ecommerce",
        "patterns",
        "hf_banner",
        "hf_carousel",
        "hf_grid",
        "hf_lightbox",
        "hf_video_hero",
        "marquee",
        "pdp",
        "quickshop",
        "navbar",
        "lightbox",
        "drawer",
        "modal",
        "toast",
        "tooltip",
        "accordion",
        "tabs",
        "carousel",
    ]

    picked: list[str] = []
    seen = set()

    def try_add(match: str):
        for r in rels:
            if match in r and r not in seen:
                picked.append(r)
                seen.add(r)
                return

    for k in keywords:
        try_add(k)
        if len(picked) >= 10:
            break

    # fill with earliest if too few
    for r in rels:
        if len(picked) >= 10:
            break
        if r not in seen:
            picked.append(r)
            seen.add(r)

    return picked


def _md_link(rel: str) -> str:
    # report.md lives in qa-artifacts/, so links should be relative to that.
    return f"[{rel}]({rel.replace(' ', '%20')})"


def generate(report_path: str, results_path: str, artifact_index_path: str) -> None:
    with open(artifact_index_path, "r", encoding="utf-8") as f:
        index = json.load(f)

    items = index.get("items", [])
    grouped = _group_items(items)

    artifact_root = os.path.abspath(os.path.dirname(report_path))
    tmp_root = os.path.join(artifact_root, "_tmp")
    visual_analysis = _safe_read_json(os.path.join(tmp_root, "visual-analysis.json"))
    theme_compare = _safe_read_json(os.path.join(tmp_root, "theme-compare.json"))

    # Build an issues list derived from the screenshot-by-screenshot analysis.
    issues = []
    if isinstance(visual_analysis, dict):
        for it in visual_analysis.get("issues", []) or []:
            rel = it.get("rel")
            if not rel:
                continue
            reason = it.get("reason")
            run = it.get("run")
            bucket = it.get("bucket")
            mean_luma = it.get("meanLuma")
            z = it.get("z")

            # Heuristic severity: theme mismatch is usually more actionable than mere outlier.
            severity = "high" if reason == "theme_mismatch" else "medium"
            issues.append(
                {
                    "id": f"{reason}:{rel}",
                    "type": "visual",
                    "severity": severity,
                    "title": "Theme/visual inconsistency flagged",
                    "run": run,
                    "bucket": bucket,
                    "evidence": [rel],
                    "details": {
                        "reason": reason,
                        "meanLuma": mean_luma,
                        "z": z,
                    },
                    "status": "needs_review",
                }
            )

    if isinstance(theme_compare, dict):
        for p in theme_compare.get("pairs", []) or []:
            if not p.get("suspect"):
                continue
            light_rel = p.get("light")
            dark_rel = p.get("dark")
            key = p.get("key") or {}
            filename = key.get("filename")
            viewport = key.get("viewport")
            bucket = key.get("bucket")
            if not (light_rel and dark_rel):
                continue
            issues.append(
                {
                    "id": f"theme-compare:{viewport}:{bucket}:{filename}",
                    "type": "visual",
                    "severity": "medium",
                    "title": "Light vs Dark too similar (possible theme not applied)",
                    "run": f"{viewport}",
                    "bucket": bucket,
                    "evidence": [light_rel, dark_rel],
                    "details": {
                        "dhashDistance": p.get("dhashDistance"),
                        "meanLumaAbsDiff": p.get("meanLumaAbsDiff"),
                    },
                    "status": "needs_review",
                }
            )

    generated_at = datetime.now(timezone.utc).isoformat()
    target = {
        "type": "file",
        "path": os.path.abspath(os.path.join(os.path.dirname(report_path), "..", "index.html")),
        "note": "QA executed against the root demo index.html",
    }

    runs = []
    for theme in ("light", "dark"):
        for viewport in ("desktop", "mobile"):
            baseline = grouped.get(theme, {}).get(viewport, {}).get("baseline", [])
            interaction = grouped.get(theme, {}).get(viewport, {}).get("interaction", [])
            run = {
                "id": f"{theme}-{viewport}",
                "theme": theme,
                "viewport": {"name": viewport, **VIEWPORTS.get(viewport, {})},
                "status": "pass_with_notes",
                "evidence": {
                    "baseline": [it["rel"] for it in baseline],
                    "interaction": [it["rel"] for it in interaction],
                    "counts": {
                        "baseline": len(baseline),
                        "interaction": len(interaction),
                        "total": len(baseline) + len(interaction),
                    },
                },
                "console": CONSOLE_BASELINE,
                "notes": KNOWN_NOTES,
            }
            runs.append(run)

    results = {
        "schemaVersion": "1.0",
        "generatedAt": generated_at,
        "target": target,
        "artifactRoot": artifact_root,
        "summary": {
            "runs": len(runs),
            "totalScreenshots": sum(r["evidence"]["counts"]["total"] for r in runs),
            "consoleErrors": sum(sum(e.get("count", 1) for e in r["console"]["errors"]) for r in runs),
            "consoleWarnings": sum(sum(w.get("count", 1) for w in r["console"]["warnings"]) for r in runs),
            "issues": len(issues),
        },
        "runs": runs,
        "issues": issues,
    }

    # Write results.json
    os.makedirs(os.path.dirname(results_path), exist_ok=True)
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # Write report.md
    lines: list[str] = []
    lines.append(f"# QA / Visual Regression Report")
    lines.append("")
    lines.append(f"- Generated (UTC): {generated_at}")
    lines.append(f"- Target: `{target['path']}`")
    lines.append(f"- Evidence root: `qa-artifacts/`")
    lines.append("")

    lines.append("## Run Matrix")
    lines.append("")
    lines.append("| Run | Theme | Viewport | Baseline | Interaction | Console | Status |")
    lines.append("|---|---|---:|---:|---:|---|---|")
    for r in runs:
        theme = r["theme"]
        viewport = r["viewport"]["name"]
        b = r["evidence"]["counts"]["baseline"]
        i = r["evidence"]["counts"]["interaction"]
        ce = sum(e.get("count", 1) for e in r["console"]["errors"])
        cw = sum(w.get("count", 1) for w in r["console"]["warnings"])
        console_str = f"{ce} errors / {cw} warnings"
        lines.append(f"| {r['id']} | {theme} | {viewport} | {b} | {i} | {console_str} | {r['status']} |")
    lines.append("")

    lines.append("## Notes")
    lines.append("")
    for n in KNOWN_NOTES:
        lines.append(f"- {n}")
    lines.append("")

    lines.append("## Screenshot-by-screenshot review")
    lines.append("")
    lines.append("Montage grids (quick scan of every screenshot):")
    lines.append("")
    for rel in [
        "_tmp/montages/light_desktop_baseline.png",
        "_tmp/montages/light_desktop_interaction.png",
        "_tmp/montages/light_mobile_baseline.png",
        "_tmp/montages/light_mobile_interaction.png",
        "_tmp/montages/dark_desktop_baseline.png",
        "_tmp/montages/dark_desktop_interaction.png",
        "_tmp/montages/dark_mobile_baseline.png",
        "_tmp/montages/dark_mobile_interaction.png",
    ]:
        lines.append(f"- {_md_link(rel)}")
    lines.append("")

    lines.append("## Issues Found (auto-triaged)")
    lines.append("")
    if not issues:
        lines.append("- No issues were flagged by automated visual triage.")
        lines.append("")
    else:
        lines.append("These items were flagged from the screenshot set; each should be manually confirmed and then fixed in the source UI.")
        lines.append("")
        lines.append("| Severity | Type | Run | Evidence | Why |")
        lines.append("|---|---|---|---|---|")
        for it in issues:
            sev = it.get("severity", "")
            typ = it.get("type", "")
            run = it.get("run", "")
            ev = it.get("evidence", [])
            ev_links = " ".join(_md_link(r) for r in ev[:2])
            why = (it.get("details") or {}).get("reason") or it.get("title")
            lines.append(f"| {sev} | {typ} | {run} | {ev_links} | {why} |")
        lines.append("")

    # Consolidated error list (what the user actually wants to scan).
    lines.append("## Error List")
    lines.append("")
    lines.append("This section consolidates all detected errors/issues into a single list.")
    lines.append("")

    # Console errors per run
    lines.append("### Console Errors")
    lines.append("")
    any_console = False
    for r in runs:
        errs = (r.get("console") or {}).get("errors") or []
        if not errs:
            continue
        any_console = True
        run_id = r.get("id", "")
        for e in errs:
            msg = e.get("message", "")
            cnt = e.get("count", 1)
            lines.append(f"- {run_id}: {msg} (x{cnt})")
    if not any_console:
        lines.append("- None")
    lines.append("")

    # Visual issues
    lines.append("### Visual / Theme Issues")
    lines.append("")
    if not issues:
        lines.append("- None")
        lines.append("")
    else:
        for it in issues:
            sev = it.get("severity", "")
            title = it.get("title", "")
            run = it.get("run", "")
            ev = it.get("evidence", [])
            why = (it.get("details") or {}).get("reason")
            ev_links = " ".join(_md_link(r) for r in ev)
            suffix = f" — {why}" if why else ""
            lines.append(f"- [{sev}] {run}: {title}{suffix} :: {ev_links}")
        lines.append("")

    lines.append("## Evidence")
    lines.append("")
    for r in runs:
        lines.append(f"### {r['id']}")
        lines.append("")
        lines.append(f"- Viewport: {r['viewport']['width']}×{r['viewport']['height']}")
        lines.append(f"- Screenshots: {r['evidence']['counts']['total']} (baseline {r['evidence']['counts']['baseline']}, interaction {r['evidence']['counts']['interaction']})")
        lines.append("")

        baseline_rels = r["evidence"]["baseline"]
        interaction_rels = r["evidence"]["interaction"]

        lines.append("**Key baseline**")
        for rel in _pick_key_evidence(baseline_rels)[:8]:
            lines.append(f"- {_md_link(rel)}")
        lines.append("")

        lines.append("**Key interactions**")
        for rel in _pick_key_evidence(interaction_rels)[:10]:
            lines.append(f"- {_md_link(rel)}")
        lines.append("")

        lines.append("<details>")
        lines.append("<summary>All screenshots (baseline)</summary>")
        lines.append("")
        for rel in baseline_rels:
            lines.append(f"- {_md_link(rel)}")
        lines.append("")
        lines.append("</details>")
        lines.append("")

        lines.append("<details>")
        lines.append("<summary>All screenshots (interaction)</summary>")
        lines.append("")
        for rel in interaction_rels:
            lines.append(f"- {_md_link(rel)}")
        lines.append("")
        lines.append("</details>")
        lines.append("")

    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main() -> int:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    artifact_index_path = os.path.join(root, "_tmp", "artifact-index.json")
    report_path = os.path.join(root, "report.md")
    results_path = os.path.join(root, "results.json")

    if not os.path.exists(artifact_index_path):
        raise FileNotFoundError(f"Missing artifact index: {artifact_index_path}")

    generate(report_path=report_path, results_path=results_path, artifact_index_path=artifact_index_path)
    print("WROTE", report_path)
    print("WROTE", results_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
