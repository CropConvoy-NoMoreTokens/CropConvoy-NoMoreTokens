# Original CropConvoy image assets

Generated with the built-in image_gen tool on 24 October 2026. These are synthetic editorial illustrations, not photographs of verified suppliers, customers or team members. The reference Agrivana site's images were not reused. The generated originals remain in the image tool's saved outputs; optimized selected deliverables are inside public/images/.

## Prompt set

All four use photorealistic natural editorial agricultural photography, soft early morning/daylight, a coordinated deep-forest green palette, natural material/skin textures and no embedded text, logos, watermarks, graphics or certification claims.

1. **Hero:** Very wide 16:9 Sri Lankan vegetable farmland near Dambulla at morning, realistic crop rows and distant hills. Modest cream delivery lorry far right beside an accessible farm lane; weathered crates of tomatoes and carrots in lower-right foreground. Quiet shadowed green foliage and field on the left for HTML text. Documentary commercial quality, muted warm sunlight.
2. **Farmer:** Portrait 4:5 Sri Lankan farmer in simple practical clothing gathering ripe tomatoes into a harvest crate in a lush field. Candid posture and natural unposed face; hands and produce in focus; tactile soil, leaves and fabric.
3. **Buyer:** Portrait 4:5 fresh tomatoes, carrots and potatoes in practical reusable crates at a modest Sri Lankan wholesale produce market. Buyer's hands examine a tomato near the right edge. Emphasize produce quality and textures with soft daylight; no posed face required.
4. **Transport:** Portrait 4:5 Sri Lankan farm worker loading reusable vegetable crates onto a small cream delivery lorry beside a lush field and distant hills. Authentic modest vehicle and practical handling. No readable license plate.

Source generation identifiers: hero exec-0762eba1-d137-45b9-a88d-4b24a488ef27; farmer exec-74a2d3e3-6902-4499-92ab-4a2e30b1fe94; buyer exec-689f0c4d-125f-4d01-9d74-30b34e7207c4; transport exec-22ba9d4c-977b-4b3a-ad16-5765b1eac789.

## Delivered files

- public/images/hero-960.webp and hero-1920.webp (16:9), plus an art-directed hero-mobile.webp (720×1280).
- public/images/farmer-480.webp and farmer-800.webp (4:5).
- public/images/buyer-480.webp and buyer-800.webp (4:5).
- public/images/transport-480.webp and transport-800.webp (4:5).

scripts/prepare-assets.mjs accepts --hero, --farmer, --buyer and --transport source-file arguments to reproducibly resize/compress with sharp. Landscape hero quality 82, mobile hero 72, supporting quality 78, explicit dimensions, no metadata needed for the app. Nine final WebP files are delivered. Semantic edits should use image generation rather than image-processing code.

Figtree Variable is self-hosted through @fontsource-variable/figtree under OFL-1.1. Phosphor supplies the UI icons. The favicon is a simple CropConvoy C monogram. The map is a live basemap with attribution, separate from these generated assets.
