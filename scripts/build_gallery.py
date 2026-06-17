"""Build gallery manifest and thumbnails for the Animal World project page."""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from pathlib import Path

from PIL import Image

DATA_ROOT = Path(r"D:\animalvideo\done\Animal_World")
ANNOTATION = DATA_ROOT / "Animal_World" / "annotation_animal_world.json"
OUT_DIR = Path(__file__).resolve().parent.parent
MANIFEST_PATH = OUT_DIR / "assets" / "data" / "gallery-manifest.json"

THUMB_WIDTH = 420
JPEG_QUALITY = 80
SUBSET_SIZE = 9


def format_species_part(part: str) -> str:
    if part.endswith("_internet"):
        base = part[: -len("_internet")]
        return f"{base.replace('_', ' ').title()} (Internet)"
    return part.replace("_", " ").title()


def display_name(species: str) -> str:
    if "__" in species:
        return " & ".join(format_species_part(part) for part in species.split("__"))
    return format_species_part(species)


def instance_bucket(count: int) -> str:
    return str(count)


def item_id(image_path: str) -> str:
    return hashlib.sha1(image_path.encode("utf-8")).hexdigest()[:12]


def thumb_rel(species: str, image_name: str) -> str:
    return f"assets/gallery/thumbs/{species}/{image_name}".replace("\\", "/")


def thumb_path(species: str, image_name: str) -> Path:
    return OUT_DIR / "assets" / "gallery" / "thumbs" / species / image_name


def resolve_image_path(image_path: str) -> Path:
    return DATA_ROOT / image_path


def make_thumbnail(src: Path, dst: Path) -> tuple[int, int]:
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as img:
        img = img.convert("RGB")
        w, h = img.size
        if w > THUMB_WIDTH:
            nh = max(1, round(h * THUMB_WIDTH / w))
            img = img.resize((THUMB_WIDTH, nh), Image.Resampling.LANCZOS)
            w, h = img.size
        img.save(dst, "JPEG", quality=JPEG_QUALITY, optimize=True)
        return w, h


def ensure_thumbnail(src: Path, dst: Path) -> tuple[int, int]:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        with Image.open(dst) as img:
            return img.size
    return make_thumbnail(src, dst)


def cleanup_legacy_thumbs() -> None:
    legacy_dir = OUT_DIR / "assets" / "gallery" / "thumbs"
    if not legacy_dir.exists():
        return
    removed = 0
    for path in legacy_dir.glob("?????.jpg"):
        path.unlink()
        removed += 1
    if removed:
        print(f"removed {removed} legacy numbered thumbnails")


def simplify_instances(instances: list[dict]) -> list[dict]:
    simplified = []
    for inst in instances:
        kps = [
            {"id": kp["id"], "x": round(kp["x"], 1), "y": round(kp["y"], 1)}
            for kp in inst.get("keypoints", [])
        ]
        simplified.append(
            {
                "instance_id": inst["instance_id"],
                "bbox_xyxy": [round(v, 1) for v in inst["bbox_xyxy"]],
                "keypoint_count": inst.get("keypoint_count", len(kps)),
                "keypoints": kps,
            }
        )
    return simplified


def main() -> None:
    cleanup_legacy_thumbs()

    with ANNOTATION.open(encoding="utf-8") as f:
        annotations = json.load(f)

    records = list(annotations)
    records.sort(key=lambda item: (display_name(item["species"]), item["species"], item["image_name"]))

    species_ids = sorted({item["species"] for item in records}, key=display_name)

    items = []
    processed = 0
    for record in records:
        src = resolve_image_path(record["image_path"])
        if not src.exists():
            print(f"skip missing: {src}")
            continue

        species = record["species"]
        image_name = record["image_name"]
        rel = thumb_rel(species, image_name)
        dst = thumb_path(species, image_name)
        tw, th = ensure_thumbnail(src, dst)

        items.append(
            {
                "id": item_id(record["image_path"]),
                "species": species,
                "species_label": display_name(species),
                "image_name": image_name,
                "image_path": record["image_path"],
                "instance_count": record["instance_count"],
                "instance_bucket": instance_bucket(record["instance_count"]),
                "thumb": rel,
                "width": record["width"],
                "height": record["height"],
                "thumb_width": tw,
                "thumb_height": th,
                "instances": simplify_instances(record.get("instances", [])),
            }
        )
        processed += 1

        if processed % 250 == 0:
            print(f"processed {processed}/{len(records)}")

    species_meta = []
    for species in species_ids:
        species_items = [x for x in items if x["species"] == species]
        counts = defaultdict(int)
        for item in species_items:
            counts[item["instance_bucket"]] += 1
        species_meta.append(
            {
                "id": species,
                "label": display_name(species),
                "image_count": len(species_items),
                "instance_buckets": dict(sorted(counts.items(), key=lambda item: int(item[0]))),
            }
        )

    manifest = {
        "version": 3,
        "subset_size": SUBSET_SIZE,
        "species_count": len(species_ids),
        "image_count": len(items),
        "species": species_meta,
        "items": items,
    }

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    with MANIFEST_PATH.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(",", ":"))

    print(f"wrote {len(items)} thumbnails across {len(species_ids)} species")
    print(f"manifest: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
