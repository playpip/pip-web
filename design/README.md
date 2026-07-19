# Design source assets

## `pip.icon`
Apple **Icon Composer** source for the app icon (the soft-3D periwinkle poker chip).
Open in Icon Composer to edit layers/appearances and re-export.

- Native (iOS/macOS app): use the `.icon` directly, or export the appearance set.
- Web/PWA icons in `public/icons/` + `src/app/apple-icon.png` were generated from the
  **Dark** 1024 export. Source of truth: `public/icons/icon-source-1024.png`.
  Regenerate with:
  ```
  SRC=public/icons/icon-source-1024.png
  magick "$SRC" -filter Lanczos -resize 192x192 -strip public/icons/icon-192.png
  magick "$SRC" -filter Lanczos -resize 512x512 -strip public/icons/icon-512.png
  magick "$SRC" -filter Lanczos -resize 180x180 -strip src/app/apple-icon.png
  magick -size 1024x1024 gradient:'#303032'-'#101010' /tmp/grad.png
  magick /tmp/grad.png "$SRC" -composite -filter Lanczos -resize 512x512 -strip public/icons/icon-512-maskable.png
  ```

The flat `src/app/icon.svg` + `favicon.ico` stay flat on purpose (legible at 16px).
