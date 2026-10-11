# Kegel Simulator captures

iPhone 17 Pro, iOS 26.3, 402×874 points / 1206×2622 pixels. Isolated Bloom E2E client,
memory-only Kegel preview. These are native React Native screenshots, not HTML renders.

| State | Screenshot |
| --- | --- |
| First launch | [01-initial.png](01-initial.png) |
| Muscle discovered | [02-intro-location.png](02-intro-location.png) |
| Finding-method selection | [03-intro-find.png](03-intro-find.png) |
| Hold trainer, initial | [04-intro-hold.png](04-intro-hold.png) |
| Technique | [04b-intro-technique.png](04b-intro-technique.png) |
| After three valid trainer holds | [04c-trainer-completed.png](04c-trainer-completed.png) |
| Home, true empty history | [05-home-empty.png](05-home-empty.png) |
| Contraction | [06-exercising.png](06-exercising.png) |
| Relaxation | [06b-relaxing.png](06b-relaxing.png) |
| Paused | [07-paused.png](07-paused.png) |
| Exit confirmation | [08-exit.png](08-exit.png) |
| Full timed completion + feedback | [09-completed.png](09-completed.png) |
| Home with labeled synthetic fixture | [10-home-design-data.png](10-home-design-data.png) |
| Synthetic heat map and provisional program | [11-home-program.png](11-home-program.png) |
| Home at top, corrected safe area | [12-home-top.png](12-home-top.png) |
| Home at bottom | [13-home-bottom.png](13-home-bottom.png) |
| Home returned to top | [14-home-return-top.png](14-home-return-top.png) |

The program capture replaces the overlapping first-review screenshot. Its safe-area gutter
stays black and separate from the scroll viewport. Scrolling to the bottom and returning
to the top preserves access to the technique button and exercise CTA.

## Rendered HTML references

Served unchanged from `.local-design/kegel/` at `http://127.0.0.1:8765/`, rendered in
Chrome. These are browser captures of the supplied phone mockups; their presentation
scale and simulated system chrome differ from the native 402×874-point device.

| Reference state | Browser screenshot |
| --- | --- |
| First launch | [01-initial.jpg](html-reference/01-initial.jpg) |
| Home at top | [02-home-top.jpg](html-reference/02-home-top.jpg) |
| Home scrolled | [03-home-scrolled.jpg](html-reference/03-home-scrolled.jpg) |
| Exercising | [04-exercising.jpg](html-reference/04-exercising.jpg) |
| Paused | [05-paused.jpg](html-reference/05-paused.jpg) |
| Completed | [06-completed.jpg](html-reference/06-completed.jpg) |
| Education design board | [07-design-education-board.jpg](html-reference/07-design-education-board.jpg) |
| Daily-home design board | [08-design-home-board.jpg](html-reference/08-design-home-board.jpg) |

See the [implementation and verification report](../../phase11-2-kegel-ui.md) for setup,
changed files, visual differences, remaining approvals and data-isolation evidence.
