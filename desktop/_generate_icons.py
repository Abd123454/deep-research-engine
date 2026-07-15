"""Generate tray-icon.png (22x22) and icon.png (512x512) for the Electron
desktop wrapper. Both are a four-point sparkle in the Deep Research Engine
brand gradient (blue → purple → pink), on a transparent background.

Run once:  python3 /home/z/my-project/desktop/_generate_icons.py
"""

from PIL import Image, ImageDraw, ImageFilter
import math
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def make_sparkle(size: int, with_background: bool = False) -> Image.Image:
    """Render a four-point sparkle of the given pixel size."""
    # 4x supersample for anti-aliasing, then downscale at the end.
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    if with_background:
        # Rounded square background matching the app's dark palette
        bg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        bg_draw = ImageDraw.Draw(bg)
        radius = int(S * 0.22)
        bg_draw.rounded_rectangle(
            [(0, 0), (S - 1, S - 1)],
            radius=radius,
            fill=(30, 30, 30, 255),  # #1e1e1e
        )
        img = Image.alpha_composite(img, bg)

    cx = cy = S / 2.0

    # Build a four-point sparkle path. The shape is symmetric across both
    # axes, so we generate one quadrant and mirror it.
    #
    # Outer tip is at (cx, cy - R); waist points at (cx ± r, cy); center
    # control points define the curvature.
    R = S * 0.46          # distance from center to tip
    r = S * 0.075         # waist radius (controls how "thin" the arms are)
    inner_pull = S * 0.30 # how far the inner control points pull toward center

    # Quadrant polygon (top-right) — we use Bezier curves via polygon with
    # enough samples for smoothness.
    points = []
    # Tip at top
    points.append((cx, cy - R))
    # Curve from top tip down to the right waist
    n = 32
    # Quadratic-ish via cubic with one control point at (cx + inner_pull, cy - R*0.6)
    # and one at (cx + r, cy - inner_pull)
    p0 = (cx, cy - R)
    p1 = (cx + inner_pull * 1.05, cy - R * 0.55)
    p2 = (cx + r, cy - inner_pull * 0.5)
    p3 = (cx + r, cy)
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t ** 2 * p2[0] + t ** 3 * p3[0]
        y = (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t ** 2 * p2[1] + t ** 3 * p3[1]
        points.append((x, y))

    # Curve from right waist out to right tip
    p0 = (cx + r, cy)
    p1 = (cx + inner_pull * 0.5, cy + r)
    p2 = (cx + R * 0.55, cy + inner_pull * 1.05)
    p3 = (cx + R, cy)
    for i in range(1, n + 1):
        t = i / n
        x = (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t ** 2 * p2[0] + t ** 3 * p3[0]
        y = (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t ** 2 * p2[1] + t ** 3 * p3[1]
        points.append((x, y))

    # Mirror top-right quadrant to the other three quadrants
    def mirror_x(pts):
        return [(2 * cx - x, y) for (x, y) in pts]

    def mirror_y(pts):
        return [(x, 2 * cy - y) for (x, y) in pts]

    full = []
    full += points                              # top-right
    full += list(reversed(mirror_x(points)))    # top-left (reverse to keep CCW)
    full += list(reversed(mirror_y(points)))    # bottom-right
    full += mirror_x(mirror_y(points))          # bottom-left

    # Render the sparkle shape
    draw = ImageDraw.Draw(img)
    draw.polygon(full, fill=(138, 180, 248, 255))  # primary blue fill

    # Apply a diagonal gradient overlay: blue (top-left) → purple → pink (bottom-right)
    grad = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    grad_pixels = grad.load()
    # Gradient stops (matching loading.html + globals.css brand vars)
    stops = [
        (0.0, (138, 180, 248)),  # #8ab4f8 light blue
        (0.5, (155, 124, 246)),  # #9b7cf6 purple
        (1.0, (216, 92, 200)),   # #d85cc8 pink
    ]

    def lerp_color(t):
        if t <= stops[0][0]:
            return stops[0][1]
        if t >= stops[-1][0]:
            return stops[-1][1]
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1:
                u = (t - t0) / (t1 - t0)
                return tuple(round(c0[k] + (c1[k] - c0[k]) * u) for k in range(3))
        return stops[-1][1]

    max_d = math.hypot(S, S)
    for y in range(S):
        for x in range(S):
            # Diagonal position normalized to [0, 1]
            t = (x + y) / max_d
            c = lerp_color(t)
            grad_pixels[x, y] = (c[0], c[1], c[2], 255)

    # Mask gradient by the alpha channel of the sparkle shape
    sparkle_alpha = img.split()[3]
    grad_masked = Image.composite(grad, Image.new("RGBA", (S, S), (0, 0, 0, 0)), sparkle_alpha)

    # If we have a background, keep it; otherwise just use the masked gradient
    if with_background:
        # Composite sparkle on top of the existing background image
        result = img.copy()
        result = Image.alpha_composite(result, grad_masked)
    else:
        result = grad_masked

    # Soft glow for the larger icon (looks nicer at 512x512)
    if size >= 128:
        glow = grad_masked.filter(ImageFilter.GaussianBlur(S * 0.025))
        glow.putalpha(glow.split()[3].point(lambda a: min(a, 110)))
        if with_background:
            result = Image.alpha_composite(result, glow)
        else:
            # Stack glow underneath the sparkle on transparent bg
            tmp = Image.new("RGBA", (S, S), (0, 0, 0, 0))
            tmp = Image.alpha_composite(tmp, glow)
            tmp = Image.alpha_composite(tmp, result)
            result = tmp

    # Downscale to target size with high-quality resampling
    return result.resize((size, size), Image.LANCZOS)


def main():
    # Tray icon: 22x22, transparent background (template image on macOS).
    tray = make_sparkle(22, with_background=False)
    # On macOS this will be marked as a template image (monochrome) by main.js,
    # but the colored version looks better on Windows/Linux.
    tray_path = os.path.join(OUT_DIR, "tray-icon.png")
    tray.save(tray_path, "PNG", optimize=True)
    print(f"Wrote {tray_path} ({tray.size[0]}x{tray.size[1]})")

    # App icon: 512x512, dark rounded-square background
    icon = make_sparkle(512, with_background=True)
    icon_path = os.path.join(OUT_DIR, "icon.png")
    icon.save(icon_path, "PNG", optimize=True)
    print(f"Wrote {icon_path} ({icon.size[0]}x{icon.size[1]})")


if __name__ == "__main__":
    main()
