import os
import numpy as np
from PIL import Image, ImageDraw

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND_DIR = os.path.join(BASE_DIR, "assets", "brand")
PUBLIC_DIR = os.path.join(BASE_DIR, "public", "brand")
TAURI_DIR = os.path.join(BASE_DIR, "src-tauri", "icons")

os.makedirs(BRAND_DIR, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)
os.makedirs(TAURI_DIR, exist_ok=True)

# 1. Update nook-mark.svg
head_d = "M 100.00 50.00 C 92.67 50.00, 85.00 32.00, 78.00 26.00 C 71.00 20.00, 64.33 14.33, 58.00 14.00 C 51.67 13.67, 45.33 17.00, 40.00 24.00 C 34.67 31.00, 29.33 44.00, 26.00 56.00 C 22.67 68.00, 20.00 84.33, 20.00 96.00 C 20.00 107.67, 20.67 117.33, 26.00 126.00 C 31.33 134.67, 39.67 143.00, 52.00 148.00 C 64.33 153.00, 84.00 156.00, 100.00 156.00 C 116.00 156.00, 135.67 153.00, 148.00 148.00 C 160.33 143.00, 168.67 134.67, 174.00 126.00 C 179.33 117.33, 180.00 107.67, 180.00 96.00 C 180.00 84.33, 177.33 68.00, 174.00 56.00 C 170.67 44.00, 165.33 31.00, 160.00 24.00 C 154.67 17.00, 148.33 13.67, 142.00 14.00 C 135.67 14.33, 129.00 20.00, 122.00 26.00 C 115.00 32.00, 107.33 50.00, 100.00 50.00 Z"

nook_mark_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
  <!-- Nook Head Mark -->
  <path d="{head_d}" fill="#ECEAE5" />
  <ellipse cx="73" cy="95" rx="8" ry="12" fill="#171717" />
  <ellipse cx="127" cy="95" rx="8" ry="12" fill="#171717" />
  <path d="M 88 109 Q 100 121 112 109" stroke="#171717" stroke-width="5" stroke-linecap="round" fill="none" />
</svg>"""

with open(os.path.join(BRAND_DIR, "nook-mark.svg"), "w", encoding="utf-8") as f:
    f.write(nook_mark_svg)
with open(os.path.join(PUBLIC_DIR, "nook-mark.svg"), "w", encoding="utf-8") as f:
    f.write(nook_mark_svg)

# 2. Update nook-app-icon.svg
nook_app_icon_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="nookTileGrad" x1="0" y1="0" x2="0" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#262628" />
      <stop offset="100%" stop-color="#141416" />
    </linearGradient>
  </defs>
  <!-- Squircle Base -->
  <rect x="24" y="24" width="464" height="464" rx="108" fill="url(#nookTileGrad)" stroke="#323236" stroke-width="4" />
  <!-- Mascot Head -->
  <g transform="translate(256, 256) scale(2.4) translate(-100, -100)">
    <path d="{head_d}" fill="#ECEAE5" />
    <ellipse cx="73" cy="95" rx="8" ry="12" fill="#171717" />
    <ellipse cx="127" cy="95" rx="8" ry="12" fill="#171717" />
    <path d="M 88 109 Q 100 121 112 109" stroke="#171717" stroke-width="5" stroke-linecap="round" fill="none" />
  </g>
</svg>"""

with open(os.path.join(BRAND_DIR, "nook-app-icon.svg"), "w", encoding="utf-8") as f:
    f.write(nook_app_icon_svg)
with open(os.path.join(PUBLIC_DIR, "nook-app-icon.svg"), "w", encoding="utf-8") as f:
    f.write(nook_app_icon_svg)

# 3. High-res supersampled PNG rendering
def generate_pngs():
    import cv2
    SS = 4096
    
    # Render transparent head mark
    img_mark = np.zeros((SS, SS, 4), dtype=np.uint8)
    
    # Scale from 200x200 to SS
    scale = (SS * 0.76) / 200.0
    dx = (SS - 200.0 * scale) / 2.0
    dy = (SS - 200.0 * scale) / 2.0
    
    # Head contour points from curve
    pts_left = [
        [100, 50], [78, 26], [58, 14], [40, 24],
        [26, 56], [20, 96], [26, 126], [52, 148], [100, 156]
    ]
    pts_right = [[200 - p[0], p[1]] for p in reversed(pts_left[:-1]) if p[0] != 100]
    raw_pts = np.array(pts_left + pts_right, dtype=float)
    
    # Subdivide spline points for ultra-smooth polygon
    fine_pts = []
    n = len(raw_pts)
    for i in range(n):
        p0 = raw_pts[(i - 1) % n]
        p1 = raw_pts[i]
        p2 = raw_pts[(i + 1) % n]
        p3 = raw_pts[(i + 2) % n]
        for t in np.linspace(0, 1, 32, endpoint=False):
            t2 = t * t
            t3 = t2 * t
            # Catmull-Rom formulation
            pt = 0.5 * (
                (2 * p1) +
                (-p0 + p2) * t +
                (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                (-p0 + 3 * p1 - 3 * p2 + p3) * t3
            )
            fine_pts.append(pt)
            
    fine_pts = (np.array(fine_pts) * scale + [dx, dy]).astype(np.int32)
    cv2.fillPoly(img_mark, [fine_pts], (236, 234, 229, 255))
    
    # Eyes
    eye_rx = int(8 * scale)
    eye_ry = int(12 * scale)
    cv2.ellipse(img_mark, (int(73 * scale + dx), int(95 * scale + dy)), (eye_rx, eye_ry), 0, 0, 360, (23, 23, 23, 255), -1, cv2.LINE_AA)
    cv2.ellipse(img_mark, (int(127 * scale + dx), int(95 * scale + dy)), (eye_rx, eye_ry), 0, 0, 360, (23, 23, 23, 255), -1, cv2.LINE_AA)
    
    # Mouth curve
    mouth_pts = []
    for t in np.linspace(0, 1, 64):
        # Quadratic bezier from (88, 109) through (100, 121) to (112, 109)
        mx = (1 - t)**2 * 88 + 2 * (1 - t) * t * 100 + t**2 * 112
        my = (1 - t)**2 * 109 + 2 * (1 - t) * t * 121 + t**2 * 109
        mouth_pts.append([mx * scale + dx, my * scale + dy])
    mouth_pts = np.array(mouth_pts, dtype=np.int32).reshape(-1, 1, 2)
    cv2.polylines(img_mark, [mouth_pts], False, (23, 23, 23, 255), int(5 * scale), cv2.LINE_AA)
    
    pil_mark = Image.fromarray(img_mark).resize((1024, 1024), Image.Resampling.LANCZOS)
    pil_mark.save(os.path.join(BRAND_DIR, "nook-mark-transparent-1024.png"))
    pil_mark.save(os.path.join(PUBLIC_DIR, "nook-mark-transparent-1024.png"))
    print("Saved refined nook-mark-transparent-1024.png")
    
    # Render squircle app icon
    img_tile = np.zeros((SS, SS, 4), dtype=np.uint8)
    canvas = Image.new("RGBA", (SS, SS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    
    rect_margin = int(SS * 0.048)
    rect_size = SS - 2 * rect_margin
    corner_r = int(SS * 0.22)
    
    draw.rounded_rectangle(
        [rect_margin, rect_margin, rect_margin + rect_size, rect_margin + rect_size],
        radius=corner_r,
        fill=(26, 26, 28, 255),
        outline=(50, 50, 54, 255),
        width=int(SS * 0.008)
    )
    
    tile_cv = np.array(canvas)
    
    # Head inside squircle (scaled 56% of tile)
    tscale = (rect_size * 0.58) / 200.0
    tdx = (SS - 200.0 * tscale) / 2.0
    tdy = (SS - 200.0 * tscale) / 2.0 + (SS * 0.012)
    
    tile_head_pts = (np.array(fine_pts, dtype=float) - [dx, dy]) / scale * tscale + [tdx, tdy]
    tile_head_pts = tile_head_pts.astype(np.int32)
    cv2.fillPoly(tile_cv, [tile_head_pts], (236, 234, 229, 255))
    
    teye_rx = int(8 * tscale)
    teye_ry = int(12 * tscale)
    cv2.ellipse(tile_cv, (int(73 * tscale + tdx), int(95 * tscale + tdy)), (teye_rx, teye_ry), 0, 0, 360, (23, 23, 23, 255), -1, cv2.LINE_AA)
    cv2.ellipse(tile_cv, (int(127 * tscale + tdx), int(95 * tscale + tdy)), (teye_rx, teye_ry), 0, 0, 360, (23, 23, 23, 255), -1, cv2.LINE_AA)
    
    t_mouth_pts = []
    for t in np.linspace(0, 1, 64):
        mx = (1 - t)**2 * 88 + 2 * (1 - t) * t * 100 + t**2 * 112
        my = (1 - t)**2 * 109 + 2 * (1 - t) * t * 121 + t**2 * 109
        t_mouth_pts.append([mx * tscale + tdx, my * tscale + tdy])
    t_mouth_pts = np.array(t_mouth_pts, dtype=np.int32).reshape(-1, 1, 2)
    cv2.polylines(tile_cv, [t_mouth_pts], False, (23, 23, 23, 255), int(5 * tscale), cv2.LINE_AA)
    
    pil_tile = Image.fromarray(tile_cv).resize((1024, 1024), Image.Resampling.LANCZOS)
    pil_tile.save(os.path.join(BRAND_DIR, "nook-app-icon-1024.png"))
    pil_tile.save(os.path.join(PUBLIC_DIR, "nook-app-icon-1024.png"))
    print("Saved refined nook-app-icon-1024.png")
    
    # Save Windows ICO
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    pil_tile.save(
        os.path.join(TAURI_DIR, "icon.ico"),
        format="ICO",
        sizes=[(s, s) for s in ico_sizes]
    )
    print("Saved refined icon.ico")

generate_pngs()
print("Assets generation finished successfully!")
