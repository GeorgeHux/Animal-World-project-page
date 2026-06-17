"""Remove white backgrounds from figure PNGs, including interior white regions."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

IMAGE_DIR = Path(__file__).resolve().parent.parent / "assets" / "images"
WHITE_THRESHOLD = 250


def remove_background(path: Path) -> bool:
    with Image.open(path) as image:
        rgba = image.convert("RGBA")
    data = np.array(rgba)
    white_mask = np.all(data[:, :, :3] >= WHITE_THRESHOLD, axis=2)

    if not white_mask.any():
        return False

    data[white_mask, 3] = 0
    Image.fromarray(data, mode="RGBA").save(path, optimize=True)
    return True


def main() -> None:
    changed = 0
    paths = sorted({*IMAGE_DIR.glob("*.png"), *IMAGE_DIR.glob("*.PNG")})
    for path in paths:
        if remove_background(path):
            print(f"processed {path.name}")
            changed += 1
        else:
            print(f"skipped {path.name}")
    print(f"updated {changed} images")


if __name__ == "__main__":
    main()
