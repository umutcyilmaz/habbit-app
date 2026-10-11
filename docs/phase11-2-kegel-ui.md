# Phase 11.2 — Kegel native UI

Date: 2026-10-11. Branch: `feature/product-ui-v1`. No commit or push.

Implemented the first-time introduction, four educational steps, home, timed contraction/relaxation,
pause/resume, exit confirmation and completion with optional feedback. This is an isolated UI
preview, not a shipped workout program. No bottom-navigation or legacy route changes.

## Open the isolated preview

Use the existing installed **Bloom E2E** development client:

```sh
npm run start:e2e:kegel
xcrun simctl openurl booted 'tms-e2e://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8082'
xcrun simctl openurl booted 'tms-e2e:///debug/kegel'
```

The entry requires all four conditions: development build, E2E runtime, E2E bundle identity,
and `EXPO_PUBLIC_KEGEL_PREVIEW=1`. Production and ordinary development builds redirect this
route through the existing `/` startup gate. A full E2E relaunch is recommended when changing
preview environment flags; Fast Refresh can preserve prior closures.

The header's **Önizleme / Örnek veri** button opens a scenario menu. Deep links also accept
`?scenario=home`, `design`, `exercise`, `paused`, `completed`, and `step-1` through `step-4`.
The `paused` and direct `completed` links are explicit design fixtures. `exercise` runs the
configured duration, including its countdown and final relaxation. No accelerated completion
or skip-to-success control is added.

## Isolation and editable parameters

- [kegelConfig.ts](../src/features/kegel/kegelConfig.ts) owns all provisional repetitions,
  contraction/relaxation durations, countdown, trainer parameters, daily target, set names,
  example levels and example progression duration. Progression is deliberately not executed.
- Feature screens use component state and an active-time timer. They import no Bloom mutation
  actions, tracking/legacy state, persisted record model or storage client.
- Expo retains underlying stack screens. For the explicitly selected Kegel preview build,
  existing root providers receive a fresh **memory-only runtime** for their entire lifetime.
  This retains their required contexts without reading, copying, migrating, clearing or writing
  normal Bloom data or the existing E2E/Phase 10 saves. Navigating within the preview does not
  switch the runtime. Normal and Phase 10 provider branches retain their existing behavior.
- No Kegel persistence field/schema/key is introduced; `bloom.localState.v7` is unchanged.
  Kegel completion and feedback never call the root provider's save function.
- Empty state has unknown history/series/repetition values (`—`), an unfilled calendar, no
  fabricated current day and explicit missing-history copy. Synthetic `4 / 3/7 / 340` examples
  are available only through **Örnek veri**, including its accessibility label and history note.
  A demonstration completion leaves empty history empty and never awards streaks/achievements.
- Pausing freezes active time, ring progress, repetition and seconds. The muscle relaxes during
  a pause. Background/inactive transitions automatically pause; resuming is explicit.
  Interval, hold, training-transition and discovery timers are cleaned up on unmount/step change.
  Exit confirmation pauses the exercise; returning from the sheet keeps it paused. Confirmed
  exit returns to Kegel home without a completion. Native back removal is also intercepted.

## Reference inspection and visual differences

Both supplied files were read at the actual CSS, SVG, JavaScript and static fixture definitions.
The Kegel CSS block and final `muscleHam()` SVG are identical in the two references. The final
overrides matter: the initial hero title is left aligned, the workout close control is on the
right, and primary buttons are solid blue. These overrides are implemented.

The reference's final muscle geometry, six curved fibers, cross fibers, bladder and bones are
ported into transparent 3x PNG layers with the checked-in offline CoreGraphics generator.
React Native `Image` layers are animated with Reanimated, including the SVG's `(120,112)` muscle
origin and `.55` contracted vertical scale. The ring is a native segmented gradient with rounded
caps, driven on the UI thread. Cards/text/icon controls compose the existing V4 primitives;
feature-local colors and sizes reproduce the HTML without changing shared V4 tokens.
No WebView, remotely loaded asset, additional runtime dependency or native rebuild is needed.

Simulator inspection led to correcting clipped elliptical glow, ring edge scalloping, track
diameter, phase font weight, final hero alignment, close placement, heat-map cell sizing and synthetic-data accessibility.
The final captures are in the [screenshot gallery](qa/kegel/README.md).

| Difference from HTML | Reason / remaining limit |
| --- | --- |
| Existing V4 Inter font instead of stretched Archivo/SF Rounded | Reuses the installed font system; exact glyph widths and line breaks differ. |
| Layered native glow instead of HTML's generated canvas fog | Preserves the blue atmosphere and phase response without a browser/canvas or new library; animated mist/noise is not reproduced. |
| Native gradient segments, stroke caps and pill borders | Tiny gradient quantization and border differences remain versus continuous SVG/CSS gradients. |
| Transparent 3x illustration/icon layers | Source-derived raster layers, animated natively; some icon arc silhouettes are approximated in CoreGraphics. Muscle fibers do not separately brighten during contraction. |
| Real safe areas and scrollable education/summary content | Adapts the fixed 390×844 reference to the tested 402×874 iPhone; protects content from clipping and text growth. |
| Exit confirmation and explicit paused state | HTML closes immediately; native version offers return/exit and keeps remaining time coherent, including countdown. |
| No streak increment, earned-day roll-up, unlocking or feedback-driven duration increase | Those program and persistence rules are unapproved. Completion shows an unsaved demonstration notice instead. |
| No reference bottom bar | Current application tabs were intentionally left unchanged. Preview lives in an independent debug stack route. |
| No prototype vibration | No new haptics dependency was added. |

The initial review could only compare HTML/CSS/SVG source measurements because local `file://`
URLs were rejected. In the visual-QA follow-up, the user requested a local HTTP server. Both
unchanged files were served on loopback port 8765 and rendered in Chrome. First launch, home,
scrolled program, exercising, paused and full-timer completion were visually compared with
native captures, along with the Kegel education/daily-home design boards. The browser captures
are linked in the gallery. This supersedes the earlier rendered-browser comparison limitation.
Android, iPad and enlarged Dynamic Type remain unvalidated.

## Visual-QA follow-up — scroll/status-bar overlap

The shared `AppScreen` scroll variant places top safe-area padding on the `ScrollView` itself.
That padding preserves the initial position but does not prevent scrolled cards from drawing
behind the status bar. Kegel home now reserves `insets.top` in a feature-local black outer
`View` and sets only its own `AppScreen` top padding to zero. The scroll viewport begins below
the system gutter, including while content moves or bounces. Initial content spacing is preserved.
No shared screen, status-bar component, navigation, native configuration, workout parameter or
persistence code was changed in this follow-up.

The home-details Maestro flow now checks top, middle/program, bottom and return-to-top positions,
with settled-scroll captures. The corrected `11-home-program.png` replaces the first-review
image. Additional top, bottom and return captures are `12`–`14`. Live `simctl` captures also
confirm the system time/icons above the black gutter after gesture completion.

Follow-up verification: typecheck, Kegel verification, E2E runtime/Phase 10 verification,
release debug guards and `git diff --check` passed. All three native flows passed in **2m08s**;
the settled-scroll flow was rerun successfully. Normal Bloom and E2E AsyncStorage file hashes
still match the original pre-preview snapshot. The gallery now contains **17 native captures**
and **8 rendered HTML-reference captures**, including the settled live bottom screen.

Meaningful remaining differences are the existing Inter glyphs/line wraps, softer native glow
without canvas mist, segmented ring gradients and icon approximations. Native paused copy is
more explicit; the home lacks the reference's migrated bottom tabs and adds a labeled fixture
entry. The completion/program copy intentionally avoids persisted streaks, unlocking and
feedback-driven progression. These differences were retained; provisional product rules remain
unchanged.

Follow-up changed files: `src/features/kegel/screens/KegelHomeScreen.tsx`,
`.maestro/kegel-home-details.yaml`, this report, and `docs/qa/kegel/README.md` plus refreshed/added
native and HTML-reference captures. `app/debug/kegel.tsx` is unchanged from the first delivery.
Binary application assets are unchanged.

Review patches are provided separately from the gallery:

- [kegel-scroll-qa.patch](patches/kegel-scroll-qa.patch) contains only this follow-up's home
  safe-area fix and expanded native scroll check, relative to the first Kegel delivery.
- [kegel-ui-text-only.patch](patches/kegel-ui-text-only.patch) contains the full uncommitted
  Kegel source/scripts/test changes relative to branch HEAD. It excludes every binary image,
  the screenshot gallery and documentation. The asset generator remains included; the PNGs
  remain in the working tree and are intentionally absent from this review patch.

Both patches are checked for applicability without modifying the working tree or Git index.

## Product decisions still requiring approval

Repetition count; contraction and relaxation durations; daily set target and scheduling; level
definitions, eligibility and progression; long-hold/rest rules; feedback-driven adaptation;
approved educational/benefit wording; haptics; durable first-time completion; session/history,
streak and achievement semantics; eventual bottom-tab integration. No approval is needed to inspect
this development preview, and none of these decisions is implemented as permanent product policy.

## Verification

`npm run typecheck`, `npm run verify:kegel`, and `git diff --check` passed.
The new deterministic suite executes the real timer hook with an injected monotonic clock:
countdown/phase boundaries, final relaxation, asymmetric configurable timings, pause/resume,
20-second pause, 90-second background interval, once-only completion, unmount cleanup,
unknown-versus-synthetic data and all 36 release/identity/flag combinations.

All relevant existing suites passed:

```text
verify:persistence
verify:persistence-acknowledgement
verify:reset-continuity
verify:home-ui
verify:product-onboarding-ui
verify:e2e-runtime
verify:e2e-app-identity
verify:release-debug-guards
verify:guided-flows
verify:journey
verify:protection-reset
```

Native verification commands:

```sh
maestro test .maestro/kegel-trainer.yaml .maestro/kegel-preview.yaml \
  --test-output-dir /private/tmp/kegel-maestro-final
maestro test .maestro/kegel-home-details.yaml \
  --test-output-dir /private/tmp/kegel-home-details-fixed
```

The hold-trainer flow uses three actual 3.2-second touches and verifies automatic advance to
technique. The preview flow covers first launch, discovery gating, selection, short hold, skip,
home, countdown, contraction/relaxation, pause/resume, return from exit confirmation, full timed
completion, feedback, empty-history preservation, confirmed abandonment and synthetic-data labeling.
No clearState or Simulator clock changes are used.

Initial implementation native result: **2/2 flows passed**, exit 0, 1m53s (trainer 16s; full preview
1m37s) on the existing iPhone 17 Pro / iOS 26.3 E2E client. The additional home-detail flow
also passed after correcting the heat-map layout. Fourteen delivered screenshots
were inspected. Before/after SHA-256 comparisons of all native AsyncStorage files matched
exactly in both normal Bloom (**2 files**) and existing Bloom E2E (**3 files**).

## Changed files

Modified:

- `package.json` — isolated startup command and Kegel verification command.
- `src/app/providers/AppProviders.tsx` — opt-in, stable memory-only E2E runtime branch.

Added application/feature files:

- `app/debug/kegel.tsx`
- `src/features/kegel/kegelConfig.ts`
- `src/features/kegel/kegelPreviewMode.ts`
- `src/features/kegel/kegelPreviewRuntime.ts`
- `src/features/kegel/kegelSession.ts`
- `src/features/kegel/kegelTheme.ts`
- `src/features/kegel/useKegelExercise.ts`
- `src/features/kegel/components/KegelUI.tsx`
- `src/features/kegel/components/KegelVisuals.tsx`
- `src/features/kegel/screens/KegelPreviewScreen.tsx`
- `src/features/kegel/screens/KegelHomeScreen.tsx`
- `src/features/kegel/screens/KegelIntroScreen.tsx`
- `src/features/kegel/screens/KegelExerciseScreen.tsx`
- `src/features/kegel/screens/KegelCompletionScreen.tsx`

Added assets under `src/features/kegel/assets/`:

```text
bladder.png, bones.png, connectors.png, glow.png, muscle.png
icon-bed.png, icon-body.png, icon-cal.png, icon-clock.png, icon-drop.png
icon-flame.png, icon-info.png, icon-lung.png, icon-rep.png, icon-timer.png
icon-up.png, icon-warn.png, icon-wave.png, icon-wind.png
```

Added verification/delivery files:

- `scripts/render-kegel-assets.swift`
- `scripts/verify-bloom-kegel.cjs`
- `.maestro/kegel-preview.yaml`
- `.maestro/kegel-trainer.yaml`
- `.maestro/kegel-home-details.yaml`
- `docs/phase11-2-kegel-ui.md`
- `docs/qa/kegel/README.md` and the individually listed Simulator PNGs in that gallery.

## Kısa Türkçe özet

Kegel’in eğitim, ana ekran, animasyonlu egzersiz, duraklatma/çıkış ve tamamlanma arayüzleri
yerel React Native bileşenleriyle oluşturuldu. Program değerleri tek dosyada ve geçici.
Önizleme kullanıcı verisini okumaz veya kaydetmez; boş durum ve örnek veriler ayrıdır.
Mevcut navigasyon, eski rotalar ve v7 şeması korunmuştur. HTML’den kalan görsel farklar ve
henüz onaylanmamış ürün kuralları yukarıda açıkça belgelenmiştir.
