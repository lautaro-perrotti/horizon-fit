// ECharts (vendored) with colors read from the active theme. Missing days stay null: gaps, never zeros.
import { day, num } from "../core/format.js";

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function seriesToLine(series) {
  return {
    days: (series?.current?.points ?? []).map((point) => point.day),
    values: (series?.current?.points ?? []).map((point) => (point.value == null ? null : Number(point.value))),
    previous: series?.previous ? series.previous.points.map((point) => (point.value == null ? null : Number(point.value))) : null,
  };
}

export function chartState(series) {
  if (!series) return { status: "unknown", reason: "missing_series", plottable: false };
  const status = series.current?.status || "unknown";
  return {
    status,
    reason: status === "unknown" ? "no_observation" : undefined,
    plottable: status === "ok" || status === "zero" || status === "stale",
  };
}

export function lineOption(lines, { compare = true, percent = false, digits = 0 } = {}) {
  const ink3 = token("--ink-3");
  const hair = token("--hair");
  const fmt = (v) => (v == null ? "—" : percent ? `${num(v * 100, 1)} %` : num(v, digits));
  const series = [
    {
      name: lines.label ?? "actual",
      type: "line",
      data: lines.values,
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 2.25, color: token("--act") },
      itemStyle: { color: token("--act") },
      areaStyle: { color: token("--act-soft") },
    },
  ];
  if (compare && lines.previous) {
    series.push({
      name: "ventana anterior",
      type: "line",
      data: lines.previous,
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 1.5, type: "dashed", color: token("--prev") },
      itemStyle: { color: token("--prev") },
    });
  }
  return {
    animation: false,
    textStyle: { fontFamily: token("--f") || "Archivo" },
    grid: { left: 6, right: 14, top: 14, bottom: 4, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: token("--s3"),
      borderColor: token("--line"),
      textStyle: { color: token("--ink"), fontSize: 12 },
      valueFormatter: fmt,
    },
    xAxis: {
      type: "category",
      data: lines.days.map((d) => day(d)),
      boundaryGap: false,
      axisLine: { lineStyle: { color: hair } },
      axisTick: { show: false },
      axisLabel: { color: ink3, fontSize: 10.5, hideOverlap: true },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: hair } },
      axisLabel: { color: ink3, fontSize: 10.5, formatter: (v) => (percent ? `${num(v * 100, 0)} %` : num(v)) },
    },
    series,
  };
}

/** Renders into `host`; returns a disposer. */
export function renderLine(host, lines, options) {
  const echarts = window.echarts;
  if (!host || !echarts) return () => undefined;
  const chart = echarts.init(host, null, { renderer: "canvas" });
  chart.setOption(lineOption(lines, options));
  const observer = new ResizeObserver(() => chart.resize());
  observer.observe(host);
  return () => {
    observer.disconnect();
    chart.dispose();
  };
}
