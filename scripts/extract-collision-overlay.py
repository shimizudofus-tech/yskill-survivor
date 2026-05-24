#!/usr/bin/env python3
"""Extract pillar centroids from Gemini collision overlay (red circles on green/red map)."""

from __future__ import annotations

import math
import sys
from collections import deque
from pathlib import Path

from PIL import Image

TARGET_W, TARGET_H = 720, 1280


def is_red(r: int, g: int, b: int) -> bool:
    return r > 180 and g < 80 and b < 80


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        r"C:\Users\yop\.cursor\projects\c-Users-yop-build-sim\assets"
        r"\c__Users_yop_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images"
        r"_image-c39a5d0c-f0eb-4561-96d3-b34a1735034e.png"
    )
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    sx, sy = TARGET_W / w, TARGET_H / h

    seen = bytearray(w * h)
    blobs: list[tuple[int, float, float, float]] = []

    for y in range(h):
        for x in range(w):
            if seen[y * w + x]:
                continue
            r, g, b = px[x, y]
            if not is_red(r, g, b):
                continue
            q: deque[tuple[int, int]] = deque([(x, y)])
            seen[y * w + x] = 1
            pts: list[tuple[int, int]] = []
            while q:
                cx, cy = q.popleft()
                pts.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                        rr, gg, bb = px[nx, ny]
                        if is_red(rr, gg, bb):
                            seen[ny * w + nx] = 1
                            q.append((nx, ny))
            if len(pts) < 100:
                continue
            cx = sum(p[0] for p in pts) / len(pts)
            cy = sum(p[1] for p in pts) / len(pts)
            rad = math.sqrt(max((p[0] - cx) ** 2 + (p[1] - cy) ** 2 for p in pts))
            blobs.append((len(pts), cx, cy, rad))

    blobs.sort(key=lambda b: (b[2], b[1]))
    print(f"// source {path.name} ({w}x{h}) -> world {TARGET_W}x{TARGET_H}")
    print(f"// pillars: {len(blobs)}")
    for i, b in enumerate(blobs):
        x, y = round(b[1] * sx), round(b[2] * sy)
        r = round(max(20, min(28, b[3] * ((sx + sy) / 2))))
        print(f'    {{ x: {x}, y: {y}, radius: {r}, zone: "pillar_{i}" }},')


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--ellipse":
        import math

        cx, cy, rx, ry, n = 360, 630, 272, 300, 18
        for i in range(n):
            a = -math.pi / 2 + i * (2 * math.pi / n)
            x = round(cx + rx * math.cos(a))
            y = round(cy + ry * math.sin(a))
            print(f'    {{ x: {x}, y: {y}, radius: 24, zone: "pillar_{i}" }},')
    else:
        main()
