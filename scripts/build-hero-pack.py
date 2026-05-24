#!/usr/bin/env python3
"""Slice hero spritesheet drafts into game-ready 128px frame packs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PLAY = ROOT / "www" / "play" / "assets" / "hero"
REF = PLAY / "references"
ARIN_SHEET = REF / "arin-spritesheet-layer.png"
ARIN_SHEET_FALLBACK = REF / "arin-spritesheet-draft.png"
LYRA_SHEET = REF / "lyra-spritesheet-layer.png"
LYRA_SHEET_FALLBACK = REF / "lyra-spritesheet-draft.png"

CANVAS = 128
FOOT_Y = 118
# Max character fill inside 128px frame (lower = smaller hero on screen).
FRAME_FILL_W = 0.68
FRAME_FILL_H = 0.72

STANDARD_ROWS = [
    ("movement/frames_128", "idle", 0),
    ("movement/frames_128", "walk_down", 1),
    ("movement/frames_128", "walk_side", 2),
    ("movement/frames_128", "walk_up", 3),
    ("attacks/front_slash/frames_128", "front_slash", 4),
    ("attacks/circle_slash/frames_128", "circle_slash", 5),
    ("attacks/dash/frames_128", "dash", 6),
    ("attacks/magic_shot/frames_128", "magic_shot", 7),
]


def is_green_bg(r: int, g: int, b: int) -> bool:
    if g >= 130 and g >= r + 35 and g >= b + 35:
        return True
    if g > r and g > b and r < 100 and b < 100 and g < 130:
        return True
    return False


def is_dark_bg(r: int, g: int, b: int, threshold: int = 48) -> bool:
    return r <= threshold and g <= threshold and b <= threshold + 15


def _bg_pixel(r: int, g: int, b: int, mode: str) -> bool:
    green = is_green_bg(r, g, b)
    dark = is_dark_bg(r, g, b)
    if mode == "green":
        return green or dark
    if mode == "dark":
        return dark
    return green or dark


def flood_remove_background(im: Image.Image, mode: str = "green") -> Image.Image:
    """Remove background connected to image edges (handles green boxes around sprite)."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    stack: list[tuple[int, int]] = []

    def push(x: int, y: int) -> None:
        if 0 <= x < w and 0 <= y < h and not seen[y * w + x]:
            seen[y * w + x] = 1
            stack.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    while stack:
        x, y = stack.pop()
        r, g, b, a = px[x, y]
        if a < 8 or _bg_pixel(r, g, b, mode):
            px[x, y] = (0, 0, 0, 0)
            push(x - 1, y)
            push(x + 1, y)
            push(x, y - 1)
            push(x, y + 1)
        else:
            px[x, y] = (r, g, b, 255)

    return im


def remove_background(im: Image.Image, mode: str = "auto") -> Image.Image:
    im = flood_remove_background(im, mode if mode != "auto" else "green")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if _bg_pixel(r, g, b, mode if mode != "auto" else "green"):
                px[x, y] = (0, 0, 0, 0)
            elif g > max(r, b) + 30:
                px[x, y] = (r, min(g, max(r, b) + 8), b, 255)
            else:
                px[x, y] = (r, g, b, 255)
    return im


def trim_alpha(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def foot_point(im: Image.Image) -> tuple[int, int]:
    px = im.load()
    w, h = im.size
    for y in range(h - 1, -1, -1):
        if any(px[x, y][3] > 20 for x in range(w)):
            xs = [x for x in range(w) if px[x, y][3] > 20]
            return (sum(xs) // len(xs), y) if xs else (w // 2, y)
    return w // 2, h - 1


def solidify_alpha(im: Image.Image, cutoff: int = 1) -> Image.Image:
    """Force every visible pixel fully opaque — no semi-transparent fringe."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a <= cutoff:
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (r, g, b, 255)
    return im


def fit_frame(im: Image.Image, scale_mul: float = 1.0) -> Image.Image:
    im = trim_alpha(im)
    if im.width == 0 or im.height == 0:
        return Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))

    fx, fy = foot_point(im)
    max_w = int(CANVAS * FRAME_FILL_W)
    max_h = int(CANVAS * FRAME_FILL_H)
    # Allow upscaling — Layer cells often have a tiny character with large margins.
    scale = min(max_w / im.width, max_h / im.height) * scale_mul
    nw = max(1, int(im.width * scale))
    nh = max(1, int(im.height * scale))
    resized = solidify_alpha(im.resize((nw, nh), Image.Resampling.LANCZOS))

    fx = int(fx * scale)
    fy = int(fy * scale)
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    out.paste(resized, (CANVAS // 2 - fx, FOOT_Y - fy), resized)
    # Re-tighten so drawImage doesn't shrink the hero with empty margins.
    tight = trim_alpha(out)
    if tight.width == 0:
        return out
    tw, th = tight.size
    scale2 = min(CANVAS * FRAME_FILL_W / tw, CANVAS * FRAME_FILL_H / th)
    tight = solidify_alpha(
        tight.resize((max(1, int(tw * scale2)), max(1, int(th * scale2))), Image.Resampling.LANCZOS)
    )
    fx2, fy2 = foot_point(tight)
    final = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    final.paste(tight, (CANVAS // 2 - fx2, FOOT_Y - fy2), tight)
    return solidify_alpha(final)


def row_scale_mul(frames: list[Image.Image]) -> float:
    trimmed = [trim_alpha(f) for f in frames]
    scales = []
    for t in trimmed:
        if t.width == 0:
            continue
        scales.append(min(CANVAS * FRAME_FILL_W / t.width, CANVAS * FRAME_FILL_H / t.height))
    return min(scales) if scales else 1.0


def slice_sheet(
    sheet_path: Path,
    row_map: list[tuple[str, str, int]],
    cols: int,
    rows: int,
    frame_count: int,
    bg_mode: str,
    normalize_rows: bool,
    inset: int,
) -> dict[str, list[Image.Image]]:
    sheet = Image.open(sheet_path).convert("RGBA")
    w, h = sheet.size
    cell_w = w // cols
    cell_h = h // rows

    clips: dict[str, list[Image.Image]] = {}
    for folder_suffix, prefix, row_idx in row_map:
        raw: list[Image.Image] = []
        for col in range(frame_count):
            x0 = col * cell_w + inset
            y0 = row_idx * cell_h + inset
            x1 = (col + 1) * cell_w - inset
            y1 = (row_idx + 1) * cell_h - inset
            cell = sheet.crop((x0, y0, x1, y1))
            raw.append(solidify_alpha(remove_background(cell, bg_mode)))
        scale = row_scale_mul(raw) if normalize_rows else 1.0
        clips[f"{folder_suffix}|{prefix}"] = [fit_frame(f, scale_mul=scale) for f in raw]
    return clips


def write_clips(base: Path, clips: dict[str, list[Image.Image]]) -> None:
    for key, frames in clips.items():
        folder_suffix, prefix = key.split("|", 1)
        out_dir = base / folder_suffix
        out_dir.mkdir(parents=True, exist_ok=True)
        for i, frame in enumerate(frames, start=1):
            frame.save(out_dir / f"{prefix}_{i:02d}.png", optimize=True)


def build_full_sheet(base: Path, row_defs: list[tuple[str, str, int]], frame_count: int) -> None:
    out_w = frame_count * CANVAS
    out_h = len(row_defs) * CANVAS
    sheet = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    for out_row, (_, prefix, _src_row) in enumerate(row_defs):
        for col in range(frame_count):
            if prefix in ("idle", "walk_down", "walk_side", "walk_up"):
                fp = base / "movement" / "frames_128" / f"{prefix}_{col + 1:02d}.png"
            else:
                fp = base / "attacks" / prefix / "frames_128" / f"{prefix}_{col + 1:02d}.png"
            if fp.exists():
                im = Image.open(fp).convert("RGBA")
                sheet.paste(im, (col * CANVAS, out_row * CANVAS), im)
    out_dir = base / "full_sheet"
    out_dir.mkdir(parents=True, exist_ok=True)
    sheet.save(out_dir / "hero_sprite_sheet_transparent_128.png", optimize=True)


def _portrait_focus_crop(cleaned: Image.Image) -> Image.Image:
    """Crop head/upper-body from a keyed single-character reference."""
    w, h = cleaned.size
    bbox = cleaned.getbbox()
    if not bbox:
        return cleaned

    bx0, by0, bx1, by1 = bbox
    bw, bh = bx1 - bx0, by1 - by0
    cx = (bx0 + bx1) / 2

    pad_x = max(12, int(bw * 0.12))
    pad_top = max(8, int(bh * 0.06))
    focus_bottom = by0 + int(bh * 0.68)
    x0 = max(0, int(cx - bw * 0.52) - pad_x)
    x1 = min(w, int(cx + bw * 0.52) + pad_x)
    y0 = max(0, by0 - pad_top)
    y1 = min(h, focus_bottom)
    return trim_alpha(cleaned.crop((x0, y0, x1, y1)))


def portrait_from_sheet(
    sheet_path: Path,
    out_portrait: Path,
    out_icon: Path,
    bg_mode: str,
    side: str,
) -> None:
    del side  # legacy param; refs are single centered characters
    im = Image.open(sheet_path).convert("RGBA")
    w, h = im.size
    cleaned = trim_alpha(remove_background(im, bg_mode))
    crop = _portrait_focus_crop(cleaned)
    if crop.width == 0:
        crop = im.crop((0, 0, w // 2, h // 2))

    portrait = Image.new("RGBA", (512, 512), (8, 13, 24, 255))
    scale = min(460 / crop.width, 460 / crop.height)
    nw, nh = int(crop.width * scale), int(crop.height * scale)
    resized = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    portrait.paste(resized, ((512 - nw) // 2, (512 - nh) // 2), resized)
    out_portrait.parent.mkdir(parents=True, exist_ok=True)
    portrait.save(out_portrait, optimize=True)
    portrait.resize((128, 128), Image.Resampling.LANCZOS).save(out_icon, optimize=True)


def write_manifest(base: Path, source: str, frame_count: int) -> None:
    row_defs = [
        ("movement/idle", "idle"),
        ("movement/walk_down", "walk_down"),
        ("movement/walk_side", "walk_side"),
        ("movement/walk_up", "walk_up"),
        ("attacks/front_slash", "front_slash"),
        ("attacks/circle_slash", "circle_slash"),
        ("attacks/dash", "dash"),
        ("attacks/magic_shot", "magic_shot"),
    ]
    animations: dict[str, list[dict]] = {}
    for folder, prefix in row_defs:
        if folder.startswith("movement"):
            paths = [f"movement/frames_128/{prefix}_{i:02d}.png" for i in range(1, frame_count + 1)]
        else:
            paths = [f"attacks/{prefix}/frames_128/{prefix}_{i:02d}.png" for i in range(1, frame_count + 1)]
        animations[folder] = [{"frame": i + 1, "file_128": p} for i, p in enumerate(paths)]

    manifest = {
        "source": source,
        "source_dimensions": [frame_count * CANVAS, len(row_defs) * CANVAS],
        "notes": [
            "Generated via scripts/build-hero-pack.py",
            "128x128 canvas, foot anchor, green-screen or dark bg key",
        ],
        "animations": animations,
    }
    (base / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def build_pack(
    name: str,
    sheet: Path,
    char_sheet: Path,
    base: Path,
    row_map: list[tuple[str, str, int]],
    args: argparse.Namespace,
    portrait_side: str,
) -> None:
    print(f"Building {name} -> {base}")
    clips = slice_sheet(
        sheet, row_map, args.cols, args.rows, args.frames, args.bg, args.normalize_rows, args.inset
    )
    write_clips(base, clips)
    build_full_sheet(base, row_map, args.frames)
    write_manifest(base, sheet.name, args.frames)
    portrait_from_sheet(
        char_sheet,
        base / "ui" / "portrait_512.png",
        base / "ui" / "icon_128.png",
        args.bg,
        portrait_side,
    )
    print("  ok")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build hero frame packs from spritesheet drafts.")
    p.add_argument("--bg", choices=("auto", "dark", "green"), default="green")
    p.add_argument("--cols", type=int, default=5, help="Layer Arin sheet = 5 columns on 1024px")
    p.add_argument("--rows", type=int, default=8)
    p.add_argument("--frames", type=int, default=5)
    p.add_argument("--inset", type=int, default=4, help="Crop inside grid lines (px)")
    p.add_argument("--only", choices=("male", "female", "both"), default="both")
    p.add_argument("--normalize-rows", action="store_true", default=True)
    p.add_argument("--no-normalize-rows", dest="normalize_rows", action="store_false")
    return p.parse_args()


def resolve_arin_sheet() -> Path:
    if ARIN_SHEET.exists():
        return ARIN_SHEET
    return ARIN_SHEET_FALLBACK


def resolve_lyra_sheet() -> Path:
    if LYRA_SHEET.exists():
        return LYRA_SHEET
    return LYRA_SHEET_FALLBACK


def main() -> None:
    args = parse_args()
    if args.only in ("male", "both"):
        sheet = resolve_arin_sheet()
        if not sheet.exists():
            raise SystemExit(f"Missing Arin sheet: {ARIN_SHEET} or {ARIN_SHEET_FALLBACK}")
        portrait_src = REF / "arin-ref-v2.png"
        if not portrait_src.exists():
            portrait_src = REF / "arin-character-sheet.png"
        build_pack("Arin", sheet, portrait_src, PLAY / "male", STANDARD_ROWS, args, "left")
    if args.only in ("female", "both"):
        lyra_sheet = resolve_lyra_sheet()
        if not lyra_sheet.exists():
            raise SystemExit(f"Missing Lyra sheet: {LYRA_SHEET} or {LYRA_SHEET_FALLBACK}")
        portrait_src = REF / "lyra-ref.png"
        if not portrait_src.exists():
            portrait_src = REF / "lyra-character-sheet.png"
        build_pack(
            "Lyra",
            lyra_sheet,
            portrait_src,
            PLAY / "female",
            STANDARD_ROWS,
            args,
            "right",
        )
    print("Done.")


if __name__ == "__main__":
    main()
