// Classic script in <head>: applies the saved theme before first paint (no inline script, CSP-safe).
try {
  document.documentElement.dataset.theme = localStorage.getItem("hc_theme") === "dawn" ? "dawn" : "dusk";
} catch (error) {
  document.documentElement.dataset.theme = "dusk";
}
