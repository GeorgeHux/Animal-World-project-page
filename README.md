# Animal World Project Website

Static project page for the Animal World dataset, styled after [Articraft](https://articraft3d.github.io/).

## Local preview

Open `index.html` in a browser, or run:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`.

Gallery assets are generated from the local Animal World dataset:

```bash
python scripts/build_gallery.py
```

## Deploy to GitHub Pages

1. Create a repository (e.g. `animalworld.github.io` or `animal-world`).
2. Copy this folder contents to the repo root.
3. Enable GitHub Pages from the `main` branch.
4. Update author names, affiliations, and Paper/Code links in `index.html`.

## Customize

- Replace placeholder authors/affiliations in the hero section.
- Update Paper / Dataset / Code button URLs.
- Edit the BibTeX block in the Citation section.
