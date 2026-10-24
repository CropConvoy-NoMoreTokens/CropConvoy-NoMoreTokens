# CropConvoy theme context

An agricultural brand with an editorial landing page and practical, readable role workspaces. Inspired by the inspected Agrivana reference: forest green, mint, leaf accents, Figtree, natural photography and softly rounded controls. CropConvoy keeps its own copy, identity and harvest/transport focus. Design variance 6, motion intensity 5, visual density 4 for the landing page; workspace density prioritizes forms.

## Semantic color tokens

| Token | Light | Dark |
|---|---|---|
| canvas | #F6F8F3 | #09190D |
| surface | #FCFDF9 | #132A19 |
| surface-alt | #EAF1E6 | #1C3622 |
| ink | #09190D | #ECFEF0 |
| muted | #526055 | #B3C6B5 |
| accent | #83F674 | #83F674 |
| border | #D7E2D6 | #36523D |
| strong / readable green | #153B20 | #83F674 |
| success / background | #246D35 / #E7F5E6 | #A0E6AA / #183D22 |
| error / background | #A92D2D / #FFF0EC | #FFB4A5 / #452321 |
| informational / background | #485E36 / #EEF2DF | #D6E4B3 / #2C361E |
| keyboard focus | #256B32 | #A3FF95 |

Bright green surfaces always use #09190D text. Body copy uses ink/muted, never low-contrast neon on light surfaces. Photographic hero and brand header retain dark scrims for readable mint text in both themes. The page theme otherwise applies globally through data-theme CSS variables.

## Typography and rhythm

Figtree Variable is bundled through Fontsource, with font-display: swap and local WOFF2 files. Hero display is approximately 64–106px desktop and 42–65px mobile, with a controlled two-line headline. Body text is 16–18px; secondary text is usually 13–14px. Mobile form inputs stay at least 16px to avoid automatic browser zoom. Workspaces use smaller headings and more compact vertical spacing than the landing page.

The content width is 1240px. Mobile gutters are 20px, tablet 36px, desktop 56px. Major sections use 60–110px spacing. Inputs use 12px radii, panels/images 20–24px, primary buttons full pills. Desktop header is 72px high; mobile is 62px. Breakpoints: 1100, 900, 767 and 389px.

## Component behavior

Every button has hover, focus-visible, pressed and disabled states. Form labels are explicit; field errors and an error summary point to inputs. Confirmations use focus-managed Radix dialogs. FAQ disclosures use native details/summary. Local search uses a dialog with normal keyboard focus order and Enter-to-first-result. Copy buttons announce real clipboard success or a useful failure message.

Theme follows the operating system until manually changed. Essential-only consent keeps theme changes in memory; saved-preferences consent persists the theme. Demo identity/data and the privacy choice are essential browser state. No analytics or advertising code is included.

## Motion and layers

Motion for React provides opacity/position hero entrance, once-only section reveals, and the scroll progress bar. Hover motion is subtle. Dialogs use short opacity/scale transitions. Skeletons animate while work is pending; there is no artificial loading delay. prefers-reduced-motion removes nonessential motion, including smooth scrolling.

Layer scale: header 30, floating actions 35, privacy 40, scroll progress 45, dialog backdrop 60, dialog 61, toast 80, skip link 100. Maps stay at layer 0 so controls cannot cover dialogs.

## Imagery

Four original generated photos share natural morning light, Sri Lankan agriculture and a restrained green palette. No generated text, certifications or claimed real participants. Image prompts/provenance: ASSETS.md. Never replace missing routing data with an illustrative photo or generated map.

## Prediction workspace additions

Insights uses the same forest/mint tokens and Figtree family, with a large two-line title, image-based
produce selection and compact comparisons. Desktop uses three produce columns; mobile uses two.
Planting forms sit beside comparisons above 767px and stack above them on smaller screens.
Negative/zero outcomes never receive a recommendation badge. Strong green remains readable in both themes.
Motion is limited to a short workspace entrance and small hover transitions; reduced motion removes
these movements. Initial loading reserves page/result space to reduce layout shifts.
Generated produce imagery is documented in ASSETS.md.
