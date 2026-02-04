# QA / Visual Regression Report

- Generated (UTC): 2026-02-03T18:34:31.213193+00:00
- Target: `C:\Users\Lautaro\Horizon Fit\index.html`
- Evidence root: `qa-artifacts/`

## Run Matrix

| Run | Theme | Viewport | Baseline | Interaction | Console | Status |
|---|---|---:|---:|---:|---|---|
| light-desktop | light | desktop | 17 | 39 | 2 errors / 0 warnings | pass_with_notes |
| light-mobile | light | mobile | 5 | 36 | 2 errors / 0 warnings | pass_with_notes |
| dark-desktop | dark | desktop | 15 | 31 | 2 errors / 0 warnings | pass_with_notes |
| dark-mobile | dark | mobile | 5 | 34 | 2 errors / 0 warnings | pass_with_notes |

## Notes

- Console shows repeated 403 resource-load errors in all runs.
- Previously observed in desktop runs: aria-hidden blocked because a focused descendant existed (focus retention). Re-verify after fixing focus management.

## Screenshot-by-screenshot review

Montage grids (quick scan of every screenshot):

- [_tmp/montages/light_desktop_baseline.png](_tmp/montages/light_desktop_baseline.png)
- [_tmp/montages/light_desktop_interaction.png](_tmp/montages/light_desktop_interaction.png)
- [_tmp/montages/light_mobile_baseline.png](_tmp/montages/light_mobile_baseline.png)
- [_tmp/montages/light_mobile_interaction.png](_tmp/montages/light_mobile_interaction.png)
- [_tmp/montages/dark_desktop_baseline.png](_tmp/montages/dark_desktop_baseline.png)
- [_tmp/montages/dark_desktop_interaction.png](_tmp/montages/dark_desktop_interaction.png)
- [_tmp/montages/dark_mobile_baseline.png](_tmp/montages/dark_mobile_baseline.png)
- [_tmp/montages/dark_mobile_interaction.png](_tmp/montages/dark_mobile_interaction.png)

## Issues Found (auto-triaged)

These items were flagged from the screenshot set; each should be manually confirmed and then fixed in the source UI.

| Severity | Type | Run | Evidence | Why |
|---|---|---|---|---|
| medium | visual | dark-mobile | [dark/mobile/interaction/hf_lightbox_closed.png](dark/mobile/interaction/hf_lightbox_closed.png) | luma_outlier |
| medium | visual | dark-mobile | [dark/mobile/interaction/hf_lightbox_open.png](dark/mobile/interaction/hf_lightbox_open.png) | luma_outlier |
| medium | visual | dark-mobile | [dark/mobile/interaction/hf_lightbox_arrowright.png](dark/mobile/interaction/hf_lightbox_arrowright.png) | luma_outlier |
| medium | visual | dark-mobile | [dark/mobile/interaction/hf_carousel_baseline.png](dark/mobile/interaction/hf_carousel_baseline.png) | luma_outlier |
| medium | visual | dark-mobile | [dark/mobile/interaction/hf_lightbox_baseline.png](dark/mobile/interaction/hf_lightbox_baseline.png) | luma_outlier |
| medium | visual | dark-mobile | [dark/mobile/interaction/pdp_snippet_baseline.png](dark/mobile/interaction/pdp_snippet_baseline.png) | luma_outlier |
| medium | visual | dark-mobile | [dark/mobile/baseline/dark_mobile_ecommerce.png](dark/mobile/baseline/dark_mobile_ecommerce.png) | luma_outlier |
| medium | visual | dark-mobile | [dark/mobile/interaction/hf_video_hero_paused.png](dark/mobile/interaction/hf_video_hero_paused.png) | luma_outlier |
| high | visual | light-desktop | [light/desktop/baseline/hero_video_baseline.png](light/desktop/baseline/hero_video_baseline.png) | theme_mismatch |
| high | visual | light-desktop | [light/desktop/baseline/light_desktop_fullpage_top.png](light/desktop/baseline/light_desktop_fullpage_top.png) | theme_mismatch |
| high | visual | light-desktop | [light/desktop/interaction/navbar_menu_closed.png](light/desktop/interaction/navbar_menu_closed.png) | theme_mismatch |
| high | visual | light-mobile | [light/mobile/baseline/light_mobile_top.png](light/mobile/baseline/light_mobile_top.png) | theme_mismatch |
| high | visual | light-mobile | [light/mobile/interaction/navbar_initial.png](light/mobile/interaction/navbar_initial.png) | theme_mismatch |
| high | visual | light-mobile | [light/mobile/interaction/navbar_menu_closed.png](light/mobile/interaction/navbar_menu_closed.png) | theme_mismatch |
| high | visual | light-desktop | [light/desktop/interaction/hf_lightbox_arrowright.png](light/desktop/interaction/hf_lightbox_arrowright.png) | theme_mismatch |
| high | visual | light-desktop | [light/desktop/interaction/hf_lightbox_open.png](light/desktop/interaction/hf_lightbox_open.png) | theme_mismatch |
| high | visual | light-desktop | [light/desktop/interaction/navbar_menu_open.png](light/desktop/interaction/navbar_menu_open.png) | theme_mismatch |
| medium | visual | desktop | [light/desktop/interaction/hf_lightbox_arrowright.png](light/desktop/interaction/hf_lightbox_arrowright.png) [dark/desktop/interaction/hf_lightbox_arrowright.png](dark/desktop/interaction/hf_lightbox_arrowright.png) | Light vs Dark too similar (possible theme not applied) |
| medium | visual | desktop | [light/desktop/interaction/hf_lightbox_open.png](light/desktop/interaction/hf_lightbox_open.png) [dark/desktop/interaction/hf_lightbox_open.png](dark/desktop/interaction/hf_lightbox_open.png) | Light vs Dark too similar (possible theme not applied) |

## Error List

This section consolidates all detected errors/issues into a single list.

### Console Errors

- light-desktop: Failed to load resource: the server responded with a status of 403 () (x2)
- light-mobile: Failed to load resource: the server responded with a status of 403 () (x2)
- dark-desktop: Failed to load resource: the server responded with a status of 403 () (x2)
- dark-mobile: Failed to load resource: the server responded with a status of 403 () (x2)

### Visual / Theme Issues

- [medium] dark-mobile: Theme/visual inconsistency flagged — luma_outlier :: [dark/mobile/interaction/hf_lightbox_closed.png](dark/mobile/interaction/hf_lightbox_closed.png)
- [medium] dark-mobile: Theme/visual inconsistency flagged — luma_outlier :: [dark/mobile/interaction/hf_lightbox_open.png](dark/mobile/interaction/hf_lightbox_open.png)
- [medium] dark-mobile: Theme/visual inconsistency flagged — luma_outlier :: [dark/mobile/interaction/hf_lightbox_arrowright.png](dark/mobile/interaction/hf_lightbox_arrowright.png)
- [medium] dark-mobile: Theme/visual inconsistency flagged — luma_outlier :: [dark/mobile/interaction/hf_carousel_baseline.png](dark/mobile/interaction/hf_carousel_baseline.png)
- [medium] dark-mobile: Theme/visual inconsistency flagged — luma_outlier :: [dark/mobile/interaction/hf_lightbox_baseline.png](dark/mobile/interaction/hf_lightbox_baseline.png)
- [medium] dark-mobile: Theme/visual inconsistency flagged — luma_outlier :: [dark/mobile/interaction/pdp_snippet_baseline.png](dark/mobile/interaction/pdp_snippet_baseline.png)
- [medium] dark-mobile: Theme/visual inconsistency flagged — luma_outlier :: [dark/mobile/baseline/dark_mobile_ecommerce.png](dark/mobile/baseline/dark_mobile_ecommerce.png)
- [medium] dark-mobile: Theme/visual inconsistency flagged — luma_outlier :: [dark/mobile/interaction/hf_video_hero_paused.png](dark/mobile/interaction/hf_video_hero_paused.png)
- [high] light-desktop: Theme/visual inconsistency flagged — theme_mismatch :: [light/desktop/baseline/hero_video_baseline.png](light/desktop/baseline/hero_video_baseline.png)
- [high] light-desktop: Theme/visual inconsistency flagged — theme_mismatch :: [light/desktop/baseline/light_desktop_fullpage_top.png](light/desktop/baseline/light_desktop_fullpage_top.png)
- [high] light-desktop: Theme/visual inconsistency flagged — theme_mismatch :: [light/desktop/interaction/navbar_menu_closed.png](light/desktop/interaction/navbar_menu_closed.png)
- [high] light-mobile: Theme/visual inconsistency flagged — theme_mismatch :: [light/mobile/baseline/light_mobile_top.png](light/mobile/baseline/light_mobile_top.png)
- [high] light-mobile: Theme/visual inconsistency flagged — theme_mismatch :: [light/mobile/interaction/navbar_initial.png](light/mobile/interaction/navbar_initial.png)
- [high] light-mobile: Theme/visual inconsistency flagged — theme_mismatch :: [light/mobile/interaction/navbar_menu_closed.png](light/mobile/interaction/navbar_menu_closed.png)
- [high] light-desktop: Theme/visual inconsistency flagged — theme_mismatch :: [light/desktop/interaction/hf_lightbox_arrowright.png](light/desktop/interaction/hf_lightbox_arrowright.png)
- [high] light-desktop: Theme/visual inconsistency flagged — theme_mismatch :: [light/desktop/interaction/hf_lightbox_open.png](light/desktop/interaction/hf_lightbox_open.png)
- [high] light-desktop: Theme/visual inconsistency flagged — theme_mismatch :: [light/desktop/interaction/navbar_menu_open.png](light/desktop/interaction/navbar_menu_open.png)
- [medium] desktop: Light vs Dark too similar (possible theme not applied) :: [light/desktop/interaction/hf_lightbox_arrowright.png](light/desktop/interaction/hf_lightbox_arrowright.png) [dark/desktop/interaction/hf_lightbox_arrowright.png](dark/desktop/interaction/hf_lightbox_arrowright.png)
- [medium] desktop: Light vs Dark too similar (possible theme not applied) :: [light/desktop/interaction/hf_lightbox_open.png](light/desktop/interaction/hf_lightbox_open.png) [dark/desktop/interaction/hf_lightbox_open.png](dark/desktop/interaction/hf_lightbox_open.png)

## Evidence

### light-desktop

- Viewport: 1365×900
- Screenshots: 56 (baseline 17, interaction 39)

**Key baseline**
- [light/desktop/baseline/banner_promo_baseline.png](light/desktop/baseline/banner_promo_baseline.png)
- [light/desktop/baseline/components_baseline.png](light/desktop/baseline/components_baseline.png)
- [light/desktop/baseline/light_desktop_fullpage_marketing.png](light/desktop/baseline/light_desktop_fullpage_marketing.png)
- [light/desktop/baseline/ecommerce_baseline.png](light/desktop/baseline/ecommerce_baseline.png)
- [light/desktop/baseline/light_desktop_fullpage_patterns.png](light/desktop/baseline/light_desktop_fullpage_patterns.png)
- [light/desktop/baseline/hf_banner_baseline.png](light/desktop/baseline/hf_banner_baseline.png)
- [light/desktop/baseline/hf_carousel_baseline.png](light/desktop/baseline/hf_carousel_baseline.png)
- [light/desktop/baseline/hf_grid_filters_baseline.png](light/desktop/baseline/hf_grid_filters_baseline.png)

**Key interactions**
- [light/desktop/interaction/accordion_open.png](light/desktop/interaction/accordion_open.png)
- [light/desktop/interaction/ecommerce_quickshop_closed.png](light/desktop/interaction/ecommerce_quickshop_closed.png)
- [light/desktop/interaction/hf_banner_apply_code_clicked.png](light/desktop/interaction/hf_banner_apply_code_clicked.png)
- [light/desktop/interaction/hf_carousel_dot1.png](light/desktop/interaction/hf_carousel_dot1.png)
- [light/desktop/interaction/hf_grid_filter_calzas.png](light/desktop/interaction/hf_grid_filter_calzas.png)
- [light/desktop/interaction/hf_lightbox_arrowright.png](light/desktop/interaction/hf_lightbox_arrowright.png)
- [light/desktop/interaction/hf_video_hero_paused.png](light/desktop/interaction/hf_video_hero_paused.png)
- [light/desktop/interaction/marquee_paused.png](light/desktop/interaction/marquee_paused.png)
- [light/desktop/interaction/pdp_add_to_cart_drawer_closed.png](light/desktop/interaction/pdp_add_to_cart_drawer_closed.png)
- [light/desktop/interaction/ecommerce_quickshop_open.png](light/desktop/interaction/ecommerce_quickshop_open.png)

<details>
<summary>All screenshots (baseline)</summary>

- [light/desktop/baseline/banner_promo_baseline.png](light/desktop/baseline/banner_promo_baseline.png)
- [light/desktop/baseline/components_baseline.png](light/desktop/baseline/components_baseline.png)
- [light/desktop/baseline/ecommerce_baseline.png](light/desktop/baseline/ecommerce_baseline.png)
- [light/desktop/baseline/hero_video_baseline.png](light/desktop/baseline/hero_video_baseline.png)
- [light/desktop/baseline/hf_banner_baseline.png](light/desktop/baseline/hf_banner_baseline.png)
- [light/desktop/baseline/hf_carousel_baseline.png](light/desktop/baseline/hf_carousel_baseline.png)
- [light/desktop/baseline/hf_grid_filters_baseline.png](light/desktop/baseline/hf_grid_filters_baseline.png)
- [light/desktop/baseline/hf_lightbox_baseline.png](light/desktop/baseline/hf_lightbox_baseline.png)
- [light/desktop/baseline/hf_video_hero_baseline.png](light/desktop/baseline/hf_video_hero_baseline.png)
- [light/desktop/baseline/light_desktop_fullpage_ecommerce.png](light/desktop/baseline/light_desktop_fullpage_ecommerce.png)
- [light/desktop/baseline/light_desktop_fullpage_marketing.png](light/desktop/baseline/light_desktop_fullpage_marketing.png)
- [light/desktop/baseline/light_desktop_fullpage_patterns.png](light/desktop/baseline/light_desktop_fullpage_patterns.png)
- [light/desktop/baseline/light_desktop_fullpage_top.png](light/desktop/baseline/light_desktop_fullpage_top.png)
- [light/desktop/baseline/marquee_baseline.png](light/desktop/baseline/marquee_baseline.png)
- [light/desktop/baseline/navbar_baseline.png](light/desktop/baseline/navbar_baseline.png)
- [light/desktop/baseline/pdp_snippet_baseline.png](light/desktop/baseline/pdp_snippet_baseline.png)
- [light/desktop/baseline/slider_baseline.png](light/desktop/baseline/slider_baseline.png)

</details>

<details>
<summary>All screenshots (interaction)</summary>

- [light/desktop/interaction/accordion_open.png](light/desktop/interaction/accordion_open.png)
- [light/desktop/interaction/accordion_second_open.png](light/desktop/interaction/accordion_second_open.png)
- [light/desktop/interaction/banner_promo_hover.png](light/desktop/interaction/banner_promo_hover.png)
- [light/desktop/interaction/button_focus.png](light/desktop/interaction/button_focus.png)
- [light/desktop/interaction/drawer_closed.png](light/desktop/interaction/drawer_closed.png)
- [light/desktop/interaction/drawer_open.png](light/desktop/interaction/drawer_open.png)
- [light/desktop/interaction/ecommerce_quickshop_closed.png](light/desktop/interaction/ecommerce_quickshop_closed.png)
- [light/desktop/interaction/ecommerce_quickshop_open.png](light/desktop/interaction/ecommerce_quickshop_open.png)
- [light/desktop/interaction/form_focus_email.png](light/desktop/interaction/form_focus_email.png)
- [light/desktop/interaction/hero_cta_hover.png](light/desktop/interaction/hero_cta_hover.png)
- [light/desktop/interaction/hero_video_paused.png](light/desktop/interaction/hero_video_paused.png)
- [light/desktop/interaction/hf_banner_apply_code_clicked.png](light/desktop/interaction/hf_banner_apply_code_clicked.png)
- [light/desktop/interaction/hf_banner_closed.png](light/desktop/interaction/hf_banner_closed.png)
- [light/desktop/interaction/hf_carousel_dot1.png](light/desktop/interaction/hf_carousel_dot1.png)
- [light/desktop/interaction/hf_carousel_next_clicked.png](light/desktop/interaction/hf_carousel_next_clicked.png)
- [light/desktop/interaction/hf_grid_filter_calzas.png](light/desktop/interaction/hf_grid_filter_calzas.png)
- [light/desktop/interaction/hf_grid_filter_todos.png](light/desktop/interaction/hf_grid_filter_todos.png)
- [light/desktop/interaction/hf_lightbox_arrowright.png](light/desktop/interaction/hf_lightbox_arrowright.png)
- [light/desktop/interaction/hf_lightbox_closed.png](light/desktop/interaction/hf_lightbox_closed.png)
- [light/desktop/interaction/hf_lightbox_open.png](light/desktop/interaction/hf_lightbox_open.png)
- [light/desktop/interaction/hf_lightbox_thumb2.png](light/desktop/interaction/hf_lightbox_thumb2.png)
- [light/desktop/interaction/hf_video_hero_paused.png](light/desktop/interaction/hf_video_hero_paused.png)
- [light/desktop/interaction/marquee_paused.png](light/desktop/interaction/marquee_paused.png)
- [light/desktop/interaction/modal_closed.png](light/desktop/interaction/modal_closed.png)
- [light/desktop/interaction/modal_open.png](light/desktop/interaction/modal_open.png)
- [light/desktop/interaction/navbar_menu_closed.png](light/desktop/interaction/navbar_menu_closed.png)
- [light/desktop/interaction/navbar_menu_open.png](light/desktop/interaction/navbar_menu_open.png)
- [light/desktop/interaction/pdp_add_to_cart_drawer_closed.png](light/desktop/interaction/pdp_add_to_cart_drawer_closed.png)
- [light/desktop/interaction/pdp_add_to_cart_drawer_open.png](light/desktop/interaction/pdp_add_to_cart_drawer_open.png)
- [light/desktop/interaction/pdp_qty_increased.png](light/desktop/interaction/pdp_qty_increased.png)
- [light/desktop/interaction/pdp_size_xs_selected.png](light/desktop/interaction/pdp_size_xs_selected.png)
- [light/desktop/interaction/slider_card_hover.png](light/desktop/interaction/slider_card_hover.png)
- [light/desktop/interaction/slider_scrolled.png](light/desktop/interaction/slider_scrolled.png)
- [light/desktop/interaction/tabs_detalles.png](light/desktop/interaction/tabs_detalles.png)
- [light/desktop/interaction/tabs_envios.png](light/desktop/interaction/tabs_envios.png)
- [light/desktop/interaction/toast_after_4s.png](light/desktop/interaction/toast_after_4s.png)
- [light/desktop/interaction/toast_info_shown.png](light/desktop/interaction/toast_info_shown.png)
- [light/desktop/interaction/toast_ok_shown.png](light/desktop/interaction/toast_ok_shown.png)
- [light/desktop/interaction/tooltip_hover.png](light/desktop/interaction/tooltip_hover.png)

</details>

### light-mobile

- Viewport: 390×844
- Screenshots: 41 (baseline 5, interaction 36)

**Key baseline**
- [light/mobile/baseline/light_mobile_top.png](light/mobile/baseline/light_mobile_top.png)
- [light/mobile/baseline/light_mobile_marketing.png](light/mobile/baseline/light_mobile_marketing.png)
- [light/mobile/baseline/light_mobile_ecommerce.png](light/mobile/baseline/light_mobile_ecommerce.png)
- [light/mobile/baseline/light_mobile_patterns.png](light/mobile/baseline/light_mobile_patterns.png)
- [light/mobile/baseline/hf_banner_baseline.png](light/mobile/baseline/hf_banner_baseline.png)

**Key interactions**
- [light/mobile/interaction/marketing_section.png](light/mobile/interaction/marketing_section.png)
- [light/mobile/interaction/ecommerce_quickshop_closed.png](light/mobile/interaction/ecommerce_quickshop_closed.png)
- [light/mobile/interaction/hf_banner_closed.png](light/mobile/interaction/hf_banner_closed.png)
- [light/mobile/interaction/hf_carousel_baseline.png](light/mobile/interaction/hf_carousel_baseline.png)
- [light/mobile/interaction/hf_grid_filter_calzas.png](light/mobile/interaction/hf_grid_filter_calzas.png)
- [light/mobile/interaction/hf_lightbox_arrowright.png](light/mobile/interaction/hf_lightbox_arrowright.png)
- [light/mobile/interaction/hf_video_hero_baseline.png](light/mobile/interaction/hf_video_hero_baseline.png)
- [light/mobile/interaction/pdp_add_to_cart_drawer_closed.png](light/mobile/interaction/pdp_add_to_cart_drawer_closed.png)
- [light/mobile/interaction/ecommerce_quickshop_open.png](light/mobile/interaction/ecommerce_quickshop_open.png)
- [light/mobile/interaction/navbar_initial.png](light/mobile/interaction/navbar_initial.png)

<details>
<summary>All screenshots (baseline)</summary>

- [light/mobile/baseline/hf_banner_baseline.png](light/mobile/baseline/hf_banner_baseline.png)
- [light/mobile/baseline/light_mobile_ecommerce.png](light/mobile/baseline/light_mobile_ecommerce.png)
- [light/mobile/baseline/light_mobile_marketing.png](light/mobile/baseline/light_mobile_marketing.png)
- [light/mobile/baseline/light_mobile_patterns.png](light/mobile/baseline/light_mobile_patterns.png)
- [light/mobile/baseline/light_mobile_top.png](light/mobile/baseline/light_mobile_top.png)

</details>

<details>
<summary>All screenshots (interaction)</summary>

- [light/mobile/interaction/accordion_open.png](light/mobile/interaction/accordion_open.png)
- [light/mobile/interaction/accordion_second_open.png](light/mobile/interaction/accordion_second_open.png)
- [light/mobile/interaction/components_section.png](light/mobile/interaction/components_section.png)
- [light/mobile/interaction/drawer_closed.png](light/mobile/interaction/drawer_closed.png)
- [light/mobile/interaction/drawer_open.png](light/mobile/interaction/drawer_open.png)
- [light/mobile/interaction/ecommerce_quickshop_closed.png](light/mobile/interaction/ecommerce_quickshop_closed.png)
- [light/mobile/interaction/ecommerce_quickshop_open.png](light/mobile/interaction/ecommerce_quickshop_open.png)
- [light/mobile/interaction/hf_banner_closed.png](light/mobile/interaction/hf_banner_closed.png)
- [light/mobile/interaction/hf_banner_interaction.png](light/mobile/interaction/hf_banner_interaction.png)
- [light/mobile/interaction/hf_carousel_baseline.png](light/mobile/interaction/hf_carousel_baseline.png)
- [light/mobile/interaction/hf_carousel_dot2.png](light/mobile/interaction/hf_carousel_dot2.png)
- [light/mobile/interaction/hf_carousel_next_clicked.png](light/mobile/interaction/hf_carousel_next_clicked.png)
- [light/mobile/interaction/hf_grid_filter_calzas.png](light/mobile/interaction/hf_grid_filter_calzas.png)
- [light/mobile/interaction/hf_grid_filter_todos.png](light/mobile/interaction/hf_grid_filter_todos.png)
- [light/mobile/interaction/hf_grid_filters_baseline.png](light/mobile/interaction/hf_grid_filters_baseline.png)
- [light/mobile/interaction/hf_lightbox_arrowright.png](light/mobile/interaction/hf_lightbox_arrowright.png)
- [light/mobile/interaction/hf_lightbox_baseline.png](light/mobile/interaction/hf_lightbox_baseline.png)
- [light/mobile/interaction/hf_lightbox_closed.png](light/mobile/interaction/hf_lightbox_closed.png)
- [light/mobile/interaction/hf_lightbox_open.png](light/mobile/interaction/hf_lightbox_open.png)
- [light/mobile/interaction/hf_video_hero_baseline.png](light/mobile/interaction/hf_video_hero_baseline.png)
- [light/mobile/interaction/hf_video_hero_paused.png](light/mobile/interaction/hf_video_hero_paused.png)
- [light/mobile/interaction/marketing_section.png](light/mobile/interaction/marketing_section.png)
- [light/mobile/interaction/modal_closed.png](light/mobile/interaction/modal_closed.png)
- [light/mobile/interaction/modal_open.png](light/mobile/interaction/modal_open.png)
- [light/mobile/interaction/navbar_initial.png](light/mobile/interaction/navbar_initial.png)
- [light/mobile/interaction/navbar_menu_closed.png](light/mobile/interaction/navbar_menu_closed.png)
- [light/mobile/interaction/navbar_menu_open.png](light/mobile/interaction/navbar_menu_open.png)
- [light/mobile/interaction/pdp_add_to_cart_drawer_closed.png](light/mobile/interaction/pdp_add_to_cart_drawer_closed.png)
- [light/mobile/interaction/pdp_add_to_cart_drawer_open.png](light/mobile/interaction/pdp_add_to_cart_drawer_open.png)
- [light/mobile/interaction/pdp_qty_increased.png](light/mobile/interaction/pdp_qty_increased.png)
- [light/mobile/interaction/pdp_size_xs_selected.png](light/mobile/interaction/pdp_size_xs_selected.png)
- [light/mobile/interaction/pdp_snippet_baseline.png](light/mobile/interaction/pdp_snippet_baseline.png)
- [light/mobile/interaction/tabs_detalles.png](light/mobile/interaction/tabs_detalles.png)
- [light/mobile/interaction/tabs_envios.png](light/mobile/interaction/tabs_envios.png)
- [light/mobile/interaction/toast_after_4s.png](light/mobile/interaction/toast_after_4s.png)
- [light/mobile/interaction/tooltip_and_toast.png](light/mobile/interaction/tooltip_and_toast.png)

</details>

### dark-desktop

- Viewport: 1365×900
- Screenshots: 46 (baseline 15, interaction 31)

**Key baseline**
- [dark/desktop/baseline/components_baseline.png](dark/desktop/baseline/components_baseline.png)
- [dark/desktop/baseline/components_baseline_2.png](dark/desktop/baseline/components_baseline_2.png)
- [dark/desktop/baseline/dark_desktop_marketing.png](dark/desktop/baseline/dark_desktop_marketing.png)
- [dark/desktop/baseline/dark_desktop_ecommerce.png](dark/desktop/baseline/dark_desktop_ecommerce.png)
- [dark/desktop/baseline/dark_desktop_patterns.png](dark/desktop/baseline/dark_desktop_patterns.png)
- [dark/desktop/baseline/hf_banner_baseline.png](dark/desktop/baseline/hf_banner_baseline.png)
- [dark/desktop/baseline/hf_carousel_baseline.png](dark/desktop/baseline/hf_carousel_baseline.png)
- [dark/desktop/baseline/hf_grid_filters_baseline.png](dark/desktop/baseline/hf_grid_filters_baseline.png)

**Key interactions**
- [dark/desktop/interaction/accordion_open.png](dark/desktop/interaction/accordion_open.png)
- [dark/desktop/interaction/ecommerce_quickshop_closed.png](dark/desktop/interaction/ecommerce_quickshop_closed.png)
- [dark/desktop/interaction/hf_banner_closed_attempt.png](dark/desktop/interaction/hf_banner_closed_attempt.png)
- [dark/desktop/interaction/hf_carousel_dot2.png](dark/desktop/interaction/hf_carousel_dot2.png)
- [dark/desktop/interaction/hf_grid_filter_calzas.png](dark/desktop/interaction/hf_grid_filter_calzas.png)
- [dark/desktop/interaction/hf_lightbox_arrowright.png](dark/desktop/interaction/hf_lightbox_arrowright.png)
- [dark/desktop/interaction/hf_video_hero_toggled.png](dark/desktop/interaction/hf_video_hero_toggled.png)
- [dark/desktop/interaction/pdp_add_to_cart_drawer_closed.png](dark/desktop/interaction/pdp_add_to_cart_drawer_closed.png)
- [dark/desktop/interaction/ecommerce_quickshop_open.png](dark/desktop/interaction/ecommerce_quickshop_open.png)
- [dark/desktop/interaction/navbar_menu_closed.png](dark/desktop/interaction/navbar_menu_closed.png)

<details>
<summary>All screenshots (baseline)</summary>

- [dark/desktop/baseline/components_baseline.png](dark/desktop/baseline/components_baseline.png)
- [dark/desktop/baseline/components_baseline_2.png](dark/desktop/baseline/components_baseline_2.png)
- [dark/desktop/baseline/dark_desktop_ecommerce.png](dark/desktop/baseline/dark_desktop_ecommerce.png)
- [dark/desktop/baseline/dark_desktop_marketing.png](dark/desktop/baseline/dark_desktop_marketing.png)
- [dark/desktop/baseline/dark_desktop_patterns.png](dark/desktop/baseline/dark_desktop_patterns.png)
- [dark/desktop/baseline/dark_desktop_top.png](dark/desktop/baseline/dark_desktop_top.png)
- [dark/desktop/baseline/ecommerce_baseline.png](dark/desktop/baseline/ecommerce_baseline.png)
- [dark/desktop/baseline/hf_banner_baseline.png](dark/desktop/baseline/hf_banner_baseline.png)
- [dark/desktop/baseline/hf_carousel_baseline.png](dark/desktop/baseline/hf_carousel_baseline.png)
- [dark/desktop/baseline/hf_grid_filters_baseline.png](dark/desktop/baseline/hf_grid_filters_baseline.png)
- [dark/desktop/baseline/hf_lightbox_baseline.png](dark/desktop/baseline/hf_lightbox_baseline.png)
- [dark/desktop/baseline/hf_video_hero_baseline.png](dark/desktop/baseline/hf_video_hero_baseline.png)
- [dark/desktop/baseline/marquee_baseline.png](dark/desktop/baseline/marquee_baseline.png)
- [dark/desktop/baseline/patterns_baseline.png](dark/desktop/baseline/patterns_baseline.png)
- [dark/desktop/baseline/pdp_snippet_baseline.png](dark/desktop/baseline/pdp_snippet_baseline.png)

</details>

<details>
<summary>All screenshots (interaction)</summary>

- [dark/desktop/interaction/accordion_open.png](dark/desktop/interaction/accordion_open.png)
- [dark/desktop/interaction/accordion_second_open.png](dark/desktop/interaction/accordion_second_open.png)
- [dark/desktop/interaction/drawer_closed.png](dark/desktop/interaction/drawer_closed.png)
- [dark/desktop/interaction/drawer_open.png](dark/desktop/interaction/drawer_open.png)
- [dark/desktop/interaction/ecommerce_quickshop_closed.png](dark/desktop/interaction/ecommerce_quickshop_closed.png)
- [dark/desktop/interaction/ecommerce_quickshop_open.png](dark/desktop/interaction/ecommerce_quickshop_open.png)
- [dark/desktop/interaction/hero_video_paused.png](dark/desktop/interaction/hero_video_paused.png)
- [dark/desktop/interaction/hf_banner_closed_attempt.png](dark/desktop/interaction/hf_banner_closed_attempt.png)
- [dark/desktop/interaction/hf_banner_interaction.png](dark/desktop/interaction/hf_banner_interaction.png)
- [dark/desktop/interaction/hf_carousel_dot2.png](dark/desktop/interaction/hf_carousel_dot2.png)
- [dark/desktop/interaction/hf_carousel_next_clicked.png](dark/desktop/interaction/hf_carousel_next_clicked.png)
- [dark/desktop/interaction/hf_grid_filter_calzas.png](dark/desktop/interaction/hf_grid_filter_calzas.png)
- [dark/desktop/interaction/hf_grid_filter_todos.png](dark/desktop/interaction/hf_grid_filter_todos.png)
- [dark/desktop/interaction/hf_lightbox_arrowright.png](dark/desktop/interaction/hf_lightbox_arrowright.png)
- [dark/desktop/interaction/hf_lightbox_closed.png](dark/desktop/interaction/hf_lightbox_closed.png)
- [dark/desktop/interaction/hf_lightbox_open.png](dark/desktop/interaction/hf_lightbox_open.png)
- [dark/desktop/interaction/hf_video_hero_toggled.png](dark/desktop/interaction/hf_video_hero_toggled.png)
- [dark/desktop/interaction/modal_closed.png](dark/desktop/interaction/modal_closed.png)
- [dark/desktop/interaction/modal_open.png](dark/desktop/interaction/modal_open.png)
- [dark/desktop/interaction/navbar_menu_closed.png](dark/desktop/interaction/navbar_menu_closed.png)
- [dark/desktop/interaction/navbar_menu_open.png](dark/desktop/interaction/navbar_menu_open.png)
- [dark/desktop/interaction/pdp_add_to_cart_drawer_closed.png](dark/desktop/interaction/pdp_add_to_cart_drawer_closed.png)
- [dark/desktop/interaction/pdp_add_to_cart_drawer_open.png](dark/desktop/interaction/pdp_add_to_cart_drawer_open.png)
- [dark/desktop/interaction/pdp_qty_increased.png](dark/desktop/interaction/pdp_qty_increased.png)
- [dark/desktop/interaction/pdp_size_xs_selected.png](dark/desktop/interaction/pdp_size_xs_selected.png)
- [dark/desktop/interaction/slider_scrolled.png](dark/desktop/interaction/slider_scrolled.png)
- [dark/desktop/interaction/tabs_detalles.png](dark/desktop/interaction/tabs_detalles.png)
- [dark/desktop/interaction/tabs_envios.png](dark/desktop/interaction/tabs_envios.png)
- [dark/desktop/interaction/toast_after_4s.png](dark/desktop/interaction/toast_after_4s.png)
- [dark/desktop/interaction/toast_info_ok_shown.png](dark/desktop/interaction/toast_info_ok_shown.png)
- [dark/desktop/interaction/tooltip_hover.png](dark/desktop/interaction/tooltip_hover.png)

</details>

### dark-mobile

- Viewport: 390×844
- Screenshots: 39 (baseline 5, interaction 34)

**Key baseline**
- [dark/mobile/baseline/dark_mobile_top.png](dark/mobile/baseline/dark_mobile_top.png)
- [dark/mobile/baseline/dark_mobile_marketing.png](dark/mobile/baseline/dark_mobile_marketing.png)
- [dark/mobile/baseline/dark_mobile_ecommerce.png](dark/mobile/baseline/dark_mobile_ecommerce.png)
- [dark/mobile/baseline/dark_mobile_patterns.png](dark/mobile/baseline/dark_mobile_patterns.png)
- [dark/mobile/baseline/hf_banner_baseline.png](dark/mobile/baseline/hf_banner_baseline.png)

**Key interactions**
- [dark/mobile/interaction/ecommerce_quickshop_closed.png](dark/mobile/interaction/ecommerce_quickshop_closed.png)
- [dark/mobile/interaction/hf_banner_apply_code_clicked.png](dark/mobile/interaction/hf_banner_apply_code_clicked.png)
- [dark/mobile/interaction/hf_carousel_baseline.png](dark/mobile/interaction/hf_carousel_baseline.png)
- [dark/mobile/interaction/hf_grid_filter_calzas.png](dark/mobile/interaction/hf_grid_filter_calzas.png)
- [dark/mobile/interaction/hf_lightbox_arrowright.png](dark/mobile/interaction/hf_lightbox_arrowright.png)
- [dark/mobile/interaction/hf_video_hero_baseline.png](dark/mobile/interaction/hf_video_hero_baseline.png)
- [dark/mobile/interaction/pdp_add_to_cart_drawer_closed.png](dark/mobile/interaction/pdp_add_to_cart_drawer_closed.png)
- [dark/mobile/interaction/ecommerce_quickshop_open.png](dark/mobile/interaction/ecommerce_quickshop_open.png)
- [dark/mobile/interaction/navbar_initial.png](dark/mobile/interaction/navbar_initial.png)
- [dark/mobile/interaction/hf_lightbox_baseline.png](dark/mobile/interaction/hf_lightbox_baseline.png)

<details>
<summary>All screenshots (baseline)</summary>

- [dark/mobile/baseline/dark_mobile_ecommerce.png](dark/mobile/baseline/dark_mobile_ecommerce.png)
- [dark/mobile/baseline/dark_mobile_marketing.png](dark/mobile/baseline/dark_mobile_marketing.png)
- [dark/mobile/baseline/dark_mobile_patterns.png](dark/mobile/baseline/dark_mobile_patterns.png)
- [dark/mobile/baseline/dark_mobile_top.png](dark/mobile/baseline/dark_mobile_top.png)
- [dark/mobile/baseline/hf_banner_baseline.png](dark/mobile/baseline/hf_banner_baseline.png)

</details>

<details>
<summary>All screenshots (interaction)</summary>

- [dark/mobile/interaction/accordion_open.png](dark/mobile/interaction/accordion_open.png)
- [dark/mobile/interaction/components_section.png](dark/mobile/interaction/components_section.png)
- [dark/mobile/interaction/drawer_closed.png](dark/mobile/interaction/drawer_closed.png)
- [dark/mobile/interaction/drawer_open.png](dark/mobile/interaction/drawer_open.png)
- [dark/mobile/interaction/ecommerce_quickshop_closed.png](dark/mobile/interaction/ecommerce_quickshop_closed.png)
- [dark/mobile/interaction/ecommerce_quickshop_open.png](dark/mobile/interaction/ecommerce_quickshop_open.png)
- [dark/mobile/interaction/hf_banner_apply_code_clicked.png](dark/mobile/interaction/hf_banner_apply_code_clicked.png)
- [dark/mobile/interaction/hf_banner_closed.png](dark/mobile/interaction/hf_banner_closed.png)
- [dark/mobile/interaction/hf_carousel_baseline.png](dark/mobile/interaction/hf_carousel_baseline.png)
- [dark/mobile/interaction/hf_carousel_dot2.png](dark/mobile/interaction/hf_carousel_dot2.png)
- [dark/mobile/interaction/hf_carousel_next_clicked.png](dark/mobile/interaction/hf_carousel_next_clicked.png)
- [dark/mobile/interaction/hf_grid_filter_calzas.png](dark/mobile/interaction/hf_grid_filter_calzas.png)
- [dark/mobile/interaction/hf_grid_filter_todos.png](dark/mobile/interaction/hf_grid_filter_todos.png)
- [dark/mobile/interaction/hf_grid_filters_baseline.png](dark/mobile/interaction/hf_grid_filters_baseline.png)
- [dark/mobile/interaction/hf_lightbox_arrowright.png](dark/mobile/interaction/hf_lightbox_arrowright.png)
- [dark/mobile/interaction/hf_lightbox_baseline.png](dark/mobile/interaction/hf_lightbox_baseline.png)
- [dark/mobile/interaction/hf_lightbox_closed.png](dark/mobile/interaction/hf_lightbox_closed.png)
- [dark/mobile/interaction/hf_lightbox_open.png](dark/mobile/interaction/hf_lightbox_open.png)
- [dark/mobile/interaction/hf_video_hero_baseline.png](dark/mobile/interaction/hf_video_hero_baseline.png)
- [dark/mobile/interaction/hf_video_hero_paused.png](dark/mobile/interaction/hf_video_hero_paused.png)
- [dark/mobile/interaction/modal_closed.png](dark/mobile/interaction/modal_closed.png)
- [dark/mobile/interaction/modal_open.png](dark/mobile/interaction/modal_open.png)
- [dark/mobile/interaction/navbar_initial.png](dark/mobile/interaction/navbar_initial.png)
- [dark/mobile/interaction/navbar_menu_closed.png](dark/mobile/interaction/navbar_menu_closed.png)
- [dark/mobile/interaction/navbar_menu_open.png](dark/mobile/interaction/navbar_menu_open.png)
- [dark/mobile/interaction/pdp_add_to_cart_drawer_closed.png](dark/mobile/interaction/pdp_add_to_cart_drawer_closed.png)
- [dark/mobile/interaction/pdp_add_to_cart_drawer_open.png](dark/mobile/interaction/pdp_add_to_cart_drawer_open.png)
- [dark/mobile/interaction/pdp_qty_increased.png](dark/mobile/interaction/pdp_qty_increased.png)
- [dark/mobile/interaction/pdp_size_xs_selected.png](dark/mobile/interaction/pdp_size_xs_selected.png)
- [dark/mobile/interaction/pdp_snippet_baseline.png](dark/mobile/interaction/pdp_snippet_baseline.png)
- [dark/mobile/interaction/tabs_detalles.png](dark/mobile/interaction/tabs_detalles.png)
- [dark/mobile/interaction/tabs_envios.png](dark/mobile/interaction/tabs_envios.png)
- [dark/mobile/interaction/toast_after_4s.png](dark/mobile/interaction/toast_after_4s.png)
- [dark/mobile/interaction/tooltip_and_toast.png](dark/mobile/interaction/tooltip_and_toast.png)

</details>

