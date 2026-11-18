import os
import cv2
import numpy as np
from PIL import Image, ImageDraw

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_DIR = os.path.join(BASE_DIR, "Nook_Identidade_Para_LLM", "referencias")
OUT_BRAND_DIR = os.path.join(BASE_DIR, "assets", "brand")
OUT_PUBLIC_DIR = os.path.join(BASE_DIR, "public", "brand")
TAURI_ICONS_DIR = os.path.join(BASE_DIR, "src-tauri", "icons")

os.makedirs(OUT_BRAND_DIR, exist_ok=True)
os.makedirs(OUT_PUBLIC_DIR, exist_ok=True)
os.makedirs(TAURI_ICONS_DIR, exist_ok=True)

COLOR_OFFWHITE = "#ECEAE5"   # Primary mascot / mark off-white
COLOR_DARK = "#171717"       # Eyes, mouth, dark details
COLOR_BOOK = "#1A1A1A"       # Notebook cover
COLOR_RIBBON = "#D4D1C9"     # Bookmark ribbon
COLOR_TILE_BG = "#1C1C1E"    # App icon squircle background
COLOR_TILE_BORDER = "#2C2C2E"

def catmull_rom_to_bezier(pts, closed=True):
    pts = np.asarray(pts, dtype=float).reshape(-1, 2)
    n = len(pts)
    if n < 3:
        return ""
    d = [f"M {pts[0][0]:.2f} {pts[0][1]:.2f}"]
    for i in range(n if closed else n - 1):
        p0 = pts[(i - 1) % n] if closed else pts[max(0, i - 1)]
        p1 = pts[i]
        p2 = pts[(i + 1) % n] if closed else pts[min(n - 1, i + 1)]
        p3 = pts[(i + 2) % n] if closed else pts[min(n - 1, i + 2)]
        
        c1x = p1[0] + (p2[0] - p0[0]) / 6.0
        c1y = p1[1] + (p2[1] - p0[1]) / 6.0
        c2x = p2[0] - (p3[0] - p1[0]) / 6.0
        c2y = p2[1] - (p3[1] - p1[1]) / 6.0
        
        d.append(f"C {c1x:.2f} {c1y:.2f}, {c2x:.2f} {c2y:.2f}, {p2[0]:.2f} {p2[1]:.2f}")
    if closed:
        d.append("Z")
    return " ".join(d)

def smooth_contour(cnt, eps=0.8):
    return cv2.approxPolyDP(cnt, eps, True)

# =========================================================================
# 1. NOOK-MARK.SVG & NOOK-WORDMARK.SVG
# =========================================================================
print("Extracting Nook Mark & Wordmark from 04_logotipo_REFERENCIA.png...")
logo_img = cv2.imread(os.path.join(REF_DIR, "04_logotipo_REFERENCIA.png"))
gray = cv2.cvtColor(logo_img, cv2.COLOR_BGR2GRAY)
_, thresh = cv2.threshold(gray, 70, 255, cv2.THRESH_BINARY)
contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE)

# Identify parts by bounding box & area
# Head mark parts:
# Contour bbox around x in [40, 220], y in [45, 205]
head_cnt = None
left_eye_cnt = None
right_eye_cnt = None
mouth_cnt = None

letter_n_cnt = None
letter_o1_outer = None
letter_o1_inner = None
letter_o2_outer = None
letter_o2_inner = None
letter_k_cnt = None

for c in contours:
    x, y, w, h = cv2.boundingRect(c)
    area = cv2.contourArea(c)
    if area > 18000 and x < 100:
        head_cnt = c
    elif x < 220:
        if 80 <= x <= 110 and 110 <= y <= 150:
            left_eye_cnt = c
        elif 145 <= x <= 180 and 110 <= y <= 150:
            right_eye_cnt = c
        elif 110 <= x <= 145 and 135 <= y <= 160:
            mouth_cnt = c
    else:
        # Letters
        if 230 <= x <= 335 and area > 4000:
            letter_n_cnt = c
        elif 340 <= x <= 435:
            if area > 4000:
                letter_o1_outer = c
            elif area > 1000:
                letter_o1_inner = c
        elif 435 <= x <= 530:
            if area > 4000:
                letter_o2_outer = c
            elif area > 1000:
                letter_o2_inner = c
        elif 530 <= x <= 625 and area > 3000:
            letter_k_cnt = c

# Normalize head coordinates for standalone nook-mark.svg
hx, hy, hw, hh = cv2.boundingRect(head_cnt)
# Pad to square viewBox 200x200
pad_x = (200 - hw) / 2.0 - hx
pad_y = (185 - hh) / 2.0 - hy

def offset_contour(cnt, dx, dy, scale=1.0):
    pts = cnt.reshape(-1, 2).astype(float)
    pts = pts * scale
    pts[:, 0] += dx
    pts[:, 1] += dy
    return pts

mark_head_pts = offset_contour(smooth_contour(head_cnt, 0.8), pad_x, pad_y)
mark_leye_pts = offset_contour(smooth_contour(left_eye_cnt, 0.5), pad_x, pad_y)
mark_reye_pts = offset_contour(smooth_contour(right_eye_cnt, 0.5), pad_x, pad_y)
mark_mouth_pts = offset_contour(smooth_contour(mouth_cnt, 0.5), pad_x, pad_y)

head_path = catmull_rom_to_bezier(mark_head_pts)
leye_path = catmull_rom_to_bezier(mark_leye_pts)
reye_path = catmull_rom_to_bezier(mark_reye_pts)
mouth_path = catmull_rom_to_bezier(mark_mouth_pts)

nook_mark_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">
  <!-- Nook Head Mark -->
  <path d="{head_path}" fill="{COLOR_OFFWHITE}" />
  <path d="{leye_path}" fill="{COLOR_DARK}" />
  <path d="{reye_path}" fill="{COLOR_DARK}" />
  <path d="{mouth_path}" fill="{COLOR_DARK}" />
</svg>"""

with open(os.path.join(OUT_BRAND_DIR, "nook-mark.svg"), "w", encoding="utf-8") as f:
    f.write(nook_mark_svg)
with open(os.path.join(OUT_PUBLIC_DIR, "nook-mark.svg"), "w", encoding="utf-8") as f:
    f.write(nook_mark_svg)
print("Saved nook-mark.svg")

# Wordmark: ViewBox 0 0 640 220
# Letters paths
wm_head_pts = offset_contour(smooth_contour(head_cnt, 0.8), -20, 10)
wm_leye_pts = offset_contour(smooth_contour(left_eye_cnt, 0.5), -20, 10)
wm_reye_pts = offset_contour(smooth_contour(right_eye_cnt, 0.5), -20, 10)
wm_mouth_pts = offset_contour(smooth_contour(mouth_cnt, 0.5), -20, 10)

wm_n_pts = offset_contour(smooth_contour(letter_n_cnt, 0.8), -20, 10)
wm_o1_out = offset_contour(smooth_contour(letter_o1_outer, 0.8), -20, 10)
wm_o1_in = offset_contour(smooth_contour(letter_o1_inner, 0.8), -20, 10)
wm_o2_out = offset_contour(smooth_contour(letter_o2_outer, 0.8), -20, 10)
wm_o2_in = offset_contour(smooth_contour(letter_o2_inner, 0.8), -20, 10)
wm_k_pts = offset_contour(smooth_contour(letter_k_cnt, 0.8), -20, 10)

wm_head_p = catmull_rom_to_bezier(wm_head_pts)
wm_leye_p = catmull_rom_to_bezier(wm_leye_pts)
wm_reye_p = catmull_rom_to_bezier(wm_reye_pts)
wm_mouth_p = catmull_rom_to_bezier(wm_mouth_pts)

wm_n_p = catmull_rom_to_bezier(wm_n_pts)
wm_o1_out_p = catmull_rom_to_bezier(wm_o1_out)
wm_o1_in_p = catmull_rom_to_bezier(wm_o1_in)
wm_o2_out_p = catmull_rom_to_bezier(wm_o2_out)
wm_o2_in_p = catmull_rom_to_bezier(wm_o2_in)
wm_k_p = catmull_rom_to_bezier(wm_k_pts)

nook_wordmark_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 220" fill="none">
  <!-- Mark -->
  <path d="{wm_head_p}" fill="{COLOR_OFFWHITE}" />
  <path d="{wm_leye_p}" fill="{COLOR_DARK}" />
  <path d="{wm_reye_p}" fill="{COLOR_DARK}" />
  <path d="{wm_mouth_p}" fill="{COLOR_DARK}" />
  <!-- Wordmark 'Nook' -->
  <path d="{wm_n_p}" fill="{COLOR_OFFWHITE}" />
  <path d="{wm_o1_out_p} {wm_o1_in_p}" fill-rule="evenodd" fill="{COLOR_OFFWHITE}" />
  <path d="{wm_o2_out_p} {wm_o2_in_p}" fill-rule="evenodd" fill="{COLOR_OFFWHITE}" />
  <path d="{wm_k_p}" fill="{COLOR_OFFWHITE}" />
</svg>"""

with open(os.path.join(OUT_BRAND_DIR, "nook-wordmark.svg"), "w", encoding="utf-8") as f:
    f.write(nook_wordmark_svg)
with open(os.path.join(OUT_PUBLIC_DIR, "nook-wordmark.svg"), "w", encoding="utf-8") as f:
    f.write(nook_wordmark_svg)
print("Saved nook-wordmark.svg")

# =========================================================================
# 2. NOOK-APP-ICON.SVG (Squircle tile with head mark)
# =========================================================================
# Standard macOS/iOS/Windows squircle container at 512x512
# Squircle: corner radius ~115px (smooth squircle)
# Head centered inside
icon_head_pts = offset_contour(smooth_contour(head_cnt, 0.8), -hx + 106, -hy + 148, scale=1.7)
icon_leye_pts = offset_contour(smooth_contour(left_eye_cnt, 0.5), -hx + 106, -hy + 148, scale=1.7)
icon_reye_pts = offset_contour(smooth_contour(right_eye_cnt, 0.5), -hx + 106, -hy + 148, scale=1.7)
icon_mouth_pts = offset_contour(smooth_contour(mouth_cnt, 0.5), -hx + 106, -hy + 148, scale=1.7)

ih_path = catmull_rom_to_bezier(icon_head_pts)
il_path = catmull_rom_to_bezier(icon_leye_pts)
ir_path = catmull_rom_to_bezier(icon_reye_pts)
im_path = catmull_rom_to_bezier(icon_mouth_pts)

nook_app_icon_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="nookTileGrad" x1="0" y1="0" x2="0" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#262628" />
      <stop offset="100%" stop-color="#121214" />
    </linearGradient>
  </defs>
  <!-- Squircle Base -->
  <rect x="24" y="24" width="464" height="464" rx="108" fill="url(#nookTileGrad)" stroke="#323236" stroke-width="4" />
  <!-- Mascot Head -->
  <path d="{ih_path}" fill="{COLOR_OFFWHITE}" />
  <path d="{il_path}" fill="{COLOR_DARK}" />
  <path d="{ir_path}" fill="{COLOR_DARK}" />
  <path d="{im_path}" fill="{COLOR_DARK}" />
</svg>"""

with open(os.path.join(OUT_BRAND_DIR, "nook-app-icon.svg"), "w", encoding="utf-8") as f:
    f.write(nook_app_icon_svg)
with open(os.path.join(OUT_PUBLIC_DIR, "nook-app-icon.svg"), "w", encoding="utf-8") as f:
    f.write(nook_app_icon_svg)
print("Saved nook-app-icon.svg")

# =========================================================================
# 3. NOOK-MASCOT.SVG (Full sitting mascot with notebook & ribbon)
# =========================================================================
print("Extracting full mascot from 02_mascote_principal_REFERENCIA.png...")
mascot_img = cv2.imread(os.path.join(REF_DIR, "02_mascote_principal_REFERENCIA.png"))
mgray = cv2.cvtColor(mascot_img, cv2.COLOR_BGR2GRAY)
_, mthresh = cv2.threshold(mgray, 70, 255, cv2.THRESH_BINARY)
mcnts, _ = cv2.findContours(mthresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE)

# Find mascot main body, sparks, paws, book
m_body = max(mcnts, key=cv2.contourArea)
mx, my, mw, mh = cv2.boundingRect(m_body)

# Dark book inside body
crop = mgray[240:445, 250:480]
book_mask = (crop < 60).astype(np.uint8) * 255
bcnts, _ = cv2.findContours(book_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
bcnts = sorted(bcnts, key=cv2.contourArea, reverse=True)
book_cnt = bcnts[0]

# Paws and feet
# Right paw: around x in [450, 520], y in [320, 400]
# Right foot: around x in [370, 460], y in [410, 480]
paw_r_cnt = None
foot_r_cnt = None
spark1_cnt = None
spark2_cnt = None
spark3_cnt = None
m_leye_cnt = None
m_reye_cnt = None
m_mouth_cnt = None

for c in mcnts:
    x, y, w, h = cv2.boundingRect(c)
    area = cv2.contourArea(c)
    if 450 <= x <= 520 and 320 <= y <= 400 and area > 1000:
        paw_r_cnt = c
    elif 370 <= x <= 460 and 410 <= y <= 485 and area > 1000:
        foot_r_cnt = c
    elif 440 <= x <= 480 and 5 <= y <= 60 and area > 200:
        spark1_cnt = c
    elif 470 <= x <= 525 and 30 <= y <= 80 and area > 200:
        spark2_cnt = c
    elif 485 <= x <= 545 and 75 <= y <= 110 and area > 200:
        spark3_cnt = c
    elif 305 <= x <= 345 and 170 <= y <= 220 and area > 200:
        m_leye_cnt = c
    elif 410 <= x <= 455 and 150 <= y <= 200 and area > 200:
        m_reye_cnt = c
    elif 365 <= x <= 415 and 190 <= y <= 220 and area > 100:
        m_mouth_cnt = c

# Bookmark ribbon on book (around x in [385, 425], y in [260, 340])
ribbon_mask = ((crop >= 180) & (crop <= 245)).astype(np.uint8) * 255
rcnts, _ = cv2.findContours(ribbon_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
rcnts = sorted(rcnts, key=cv2.contourArea, reverse=True)
ribbon_cnt = rcnts[0]

# Book top pages rim (gray around 200 at y 250..270)
rim_mask = ((crop >= 180) & (crop <= 250)).astype(np.uint8) * 255

# Normalize mascot to 520x500 viewBox
m_pad_x = (520 - mw) / 2.0 - mx
m_pad_y = (480 - mh) / 2.0 - my + 10

m_body_p = catmull_rom_to_bezier(offset_contour(smooth_contour(m_body, 0.9), m_pad_x, m_pad_y))
m_leye_p = catmull_rom_to_bezier(offset_contour(smooth_contour(m_leye_cnt, 0.5), m_pad_x, m_pad_y))
m_reye_p = catmull_rom_to_bezier(offset_contour(smooth_contour(m_reye_cnt, 0.5), m_pad_x, m_pad_y))
m_mouth_p = catmull_rom_to_bezier(offset_contour(smooth_contour(m_mouth_cnt, 0.5), m_pad_x, m_pad_y))

# Book points need offset (250, 240)
book_pts = offset_contour(smooth_contour(book_cnt, 0.9), m_pad_x + 250, m_pad_y + 240)
m_book_p = catmull_rom_to_bezier(book_pts)

ribbon_pts = offset_contour(smooth_contour(ribbon_cnt, 0.6), m_pad_x + 250, m_pad_y + 240)
m_ribbon_p = catmull_rom_to_bezier(ribbon_pts)

m_paw_r_p = catmull_rom_to_bezier(offset_contour(smooth_contour(paw_r_cnt, 0.6), m_pad_x, m_pad_y)) if paw_r_cnt is not None else ""
m_foot_r_p = catmull_rom_to_bezier(offset_contour(smooth_contour(foot_r_cnt, 0.6), m_pad_x, m_pad_y)) if foot_r_cnt is not None else ""

m_spk1_p = catmull_rom_to_bezier(offset_contour(smooth_contour(spark1_cnt, 0.6), m_pad_x, m_pad_y)) if spark1_cnt is not None else ""
m_spk2_p = catmull_rom_to_bezier(offset_contour(smooth_contour(spark2_cnt, 0.6), m_pad_x, m_pad_y)) if spark2_cnt is not None else ""
m_spk3_p = catmull_rom_to_bezier(offset_contour(smooth_contour(spark3_cnt, 0.6), m_pad_x, m_pad_y)) if spark3_cnt is not None else ""

nook_mascot_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 500" fill="none">
  <!-- Subtle Ground Shadow -->
  <ellipse cx="270" cy="470" rx="180" ry="16" fill="#141414" opacity="0.6" />
  
  <!-- Main Mascot Body & Tail -->
  <path d="{m_body_p}" fill="{COLOR_OFFWHITE}" />
  
  <!-- Face Features -->
  <path d="{m_leye_p}" fill="{COLOR_DARK}" />
  <path d="{m_reye_p}" fill="{COLOR_DARK}" />
  <path d="{m_mouth_p}" fill="{COLOR_DARK}" />

  <!-- Idea Radiating Sparks -->
  <path d="{m_spk1_p}" fill="{COLOR_OFFWHITE}" />
  <path d="{m_spk2_p}" fill="{COLOR_OFFWHITE}" />
  <path d="{m_spk3_p}" fill="{COLOR_OFFWHITE}" />

  <!-- Notebook -->
  <path d="{m_book_p}" fill="{COLOR_BOOK}" />
  
  <!-- Ribbon Bookmark -->
  <path d="{m_ribbon_p}" fill="{COLOR_RIBBON}" />

  <!-- Front Paws and Feet Layered Over Book -->
  <path d="{m_paw_r_p}" fill="{COLOR_OFFWHITE}" />
  <path d="{m_foot_r_p}" fill="{COLOR_OFFWHITE}" />
</svg>"""

with open(os.path.join(OUT_BRAND_DIR, "nook-mascot.svg"), "w", encoding="utf-8") as f:
    f.write(nook_mascot_svg)
with open(os.path.join(OUT_PUBLIC_DIR, "nook-mascot.svg"), "w", encoding="utf-8") as f:
    f.write(nook_mascot_svg)
print("Saved nook-mascot.svg")

# =========================================================================
# 4. ACTION POSES (Thinking, Writing, Checklist)
# =========================================================================
print("Extracting action poses from 05_expressoes_REFERENCIA.png...")
exp_img = cv2.imread(os.path.join(REF_DIR, "05_expressoes_REFERENCIA.png"))
egray = cv2.cvtColor(exp_img, cv2.COLOR_BGR2GRAY)

poses_def = [
    ("nook-thinking.svg", 20, 330, 260, 280),
    ("nook-writing.svg", 345, 650, 310, 280),
    ("nook-checklist.svg", 665, 965, 290, 280),
]

for filename, x1, x2, vb_w, vb_h in poses_def:
    crop = egray[:, x1:x2]
    _, cthresh = cv2.threshold(crop, 70, 255, cv2.THRESH_BINARY)
    cnts, _ = cv2.findContours(cthresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE)
    cnts = sorted(cnts, key=cv2.contourArea, reverse=True)
    body_c = cnts[0]
    bx, by, bw, bh = cv2.boundingRect(body_c)
    
    # Internal dark contours (eyes, mouth, details)
    # Inside the body crop
    inv_crop = ((crop < 70) & (crop > 10)).astype(np.uint8) * 255
    # Mask to body region
    mask_body = np.zeros_like(crop)
    cv2.drawContours(mask_body, [body_c], -1, 255, -1)
    dark_in_body = cv2.bitwise_and(inv_crop, mask_body)
    
    dcnts, _ = cv2.findContours(dark_in_body, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    px = (vb_w - bw) / 2.0 - bx
    py = (vb_h - bh) / 2.0 - by
    
    body_path = catmull_rom_to_bezier(offset_contour(smooth_contour(body_c, 0.8), px, py))
    
    # Also find satellite white blobs (thought bubble or sparks outside main body)
    satellite_paths = []
    for c in cnts[1:]:
        area = cv2.contourArea(c)
        if area > 100:
            p = catmull_rom_to_bezier(offset_contour(smooth_contour(c, 0.6), px, py))
            satellite_paths.append(p)
            
    dark_paths = []
    for dc in dcnts:
        area = cv2.contourArea(dc)
        if 40 < area < 10000:
            dp = catmull_rom_to_bezier(offset_contour(smooth_contour(dc, 0.6), px, py))
            dark_paths.append(dp)
            
    sat_svg = "\n".join([f'  <path d="{p}" fill="{COLOR_OFFWHITE}" />' for p in satellite_paths])
    dark_svg = "\n".join([f'  <path d="{p}" fill="{COLOR_DARK}" />' for p in dark_paths])
    
    pose_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb_w} {vb_h}" fill="none">
  <!-- Mascot Pose -->
  <path d="{body_path}" fill="{COLOR_OFFWHITE}" />
{sat_svg}
{dark_svg}
</svg>"""

    with open(os.path.join(OUT_BRAND_DIR, filename), "w", encoding="utf-8") as f:
        f.write(pose_svg)
    with open(os.path.join(OUT_PUBLIC_DIR, filename), "w", encoding="utf-8") as f:
        f.write(pose_svg)
    print(f"Saved {filename}")

# =========================================================================
# 5. NOOK-MARK-TRANSPARENT-1024.PNG & NOOK-APP-ICON-1024.PNG
# =========================================================================
print("Rendering 1024x1024 transparent PNGs with supersampling...")
# We supersample at 4096 x 4096 with OpenCV for pristine antialiasing, then downscale using Lanczos to 1024x1024

def render_supersampled_mark(size=1024, is_squircle=False):
    ss = 4096
    img = np.zeros((ss, ss, 4), dtype=np.uint8)
    
    # Scale from 200x200 or 512x512 to ss
    if is_squircle:
        # Draw rounded rectangle squircle
        # Corner radius 864px in 4096
        # Background gradient #242426 to #121214
        canvas = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
        draw = ImageDraw.Draw(canvas)
        # Gradient squircle
        rect_margin = int(ss * 0.05)
        rect_size = ss - 2 * rect_margin
        corner_r = int(ss * 0.22)
        
        # Base rect
        draw.rounded_rectangle(
            [rect_margin, rect_margin, rect_margin + rect_size, rect_margin + rect_size],
            radius=corner_r,
            fill=(26, 26, 28, 255),
            outline=(50, 50, 54, 255),
            width=int(ss * 0.01)
        )
        # Head mark inside
        # Head size ~ 55% of rect
        head_scale = (rect_size * 0.62) / hw
        target_cx = ss / 2.0
        target_cy = ss / 2.0 + (ss * 0.015)
        
        dx = target_cx - (hx + hw / 2.0) * head_scale
        dy = target_cy - (hy + hh / 2.0) * head_scale
        
        h_pts = (smooth_contour(head_cnt, 0.7).reshape(-1, 2) * head_scale + [dx, dy]).astype(np.int32)
        le_pts = (smooth_contour(left_eye_cnt, 0.4).reshape(-1, 2) * head_scale + [dx, dy]).astype(np.int32)
        re_pts = (smooth_contour(right_eye_cnt, 0.4).reshape(-1, 2) * head_scale + [dx, dy]).astype(np.int32)
        m_pts = (smooth_contour(mouth_cnt, 0.4).reshape(-1, 2) * head_scale + [dx, dy]).astype(np.int32)
        
        # Convert PIL to cv2 for polygon fill
        cv_img = np.array(canvas)
        cv2.fillPoly(cv_img, [h_pts], (236, 234, 229, 255))
        cv2.fillPoly(cv_img, [le_pts], (23, 23, 23, 255))
        cv2.fillPoly(cv_img, [re_pts], (23, 23, 23, 255))
        cv2.fillPoly(cv_img, [m_pts], (23, 23, 23, 255))
        final_pil = Image.fromarray(cv_img).resize((size, size), Image.Resampling.LANCZOS)
        return final_pil
    else:
        # Transparent head mark alone
        scale = (ss * 0.78) / hw
        dx = (ss - hw * scale) / 2.0 - hx * scale
        dy = (ss - hh * scale) / 2.0 - hy * scale
        
        h_pts = (smooth_contour(head_cnt, 0.7).reshape(-1, 2) * scale + [dx, dy]).astype(np.int32)
        le_pts = (smooth_contour(left_eye_cnt, 0.4).reshape(-1, 2) * scale + [dx, dy]).astype(np.int32)
        re_pts = (smooth_contour(right_eye_cnt, 0.4).reshape(-1, 2) * scale + [dx, dy]).astype(np.int32)
        m_pts = (smooth_contour(mouth_cnt, 0.4).reshape(-1, 2) * scale + [dx, dy]).astype(np.int32)
        
        cv2.fillPoly(img, [h_pts], (236, 234, 229, 255))
        cv2.fillPoly(img, [le_pts], (23, 23, 23, 255))
        cv2.fillPoly(img, [re_pts], (23, 23, 23, 255))
        cv2.fillPoly(img, [m_pts], (23, 23, 23, 255))
        
        final_pil = Image.fromarray(img).resize((size, size), Image.Resampling.LANCZOS)
        return final_pil

mark_1024 = render_supersampled_mark(1024, is_squircle=False)
mark_1024.save(os.path.join(OUT_BRAND_DIR, "nook-mark-transparent-1024.png"))
mark_1024.save(os.path.join(OUT_PUBLIC_DIR, "nook-mark-transparent-1024.png"))
print("Saved nook-mark-transparent-1024.png")

tile_1024 = render_supersampled_mark(1024, is_squircle=True)
tile_1024.save(os.path.join(OUT_BRAND_DIR, "nook-app-icon-1024.png"))
tile_1024.save(os.path.join(OUT_PUBLIC_DIR, "nook-app-icon-1024.png"))
print("Saved nook-app-icon-1024.png")

# Also generate full mascot 1024x1024 PNG
mascot_1024_canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
# Load 02_mascote_principal_REFERENCIA.png, make background transparent
m_ref = cv2.imread(os.path.join(REF_DIR, "02_mascote_principal_REFERENCIA.png"))
m_ref_gray = cv2.cvtColor(m_ref, cv2.COLOR_BGR2GRAY)
# Create transparent RGBA
m_rgba = np.zeros((m_ref.shape[0], m_ref.shape[1], 4), dtype=np.uint8)
m_rgba[:, :, 0:3] = cv2.cvtColor(m_ref, cv2.COLOR_BGR2RGB)
# Alpha is smooth threshold of darkness
alpha = np.clip((m_ref_gray.astype(float) - 15) * 6, 0, 255).astype(np.uint8)
m_rgba[:, :, 3] = alpha
m_pil = Image.fromarray(m_rgba)
# Resize to fit 900x900 inside 1024x1024
m_pil.thumbnail((920, 920), Image.Resampling.LANCZOS)
offset_x = (1024 - m_pil.width) // 2
offset_y = (1024 - m_pil.height) // 2
mascot_1024_canvas.paste(m_pil, (offset_x, offset_y), m_pil)
mascot_1024_canvas.save(os.path.join(OUT_BRAND_DIR, "nook-mascot-1024.png"))
mascot_1024_canvas.save(os.path.join(OUT_PUBLIC_DIR, "nook-mascot-1024.png"))
print("Saved nook-mascot-1024.png")

# =========================================================================
# 6. TAURI ICONS & WINDOWS .ICO GENERATION
# =========================================================================
print("Generating Windows .ico and Tauri PNG icons...")
# For the Windows app icon, we use the app tile (squircle container with mascot head)
# as shown in 03_icone_app_REFERENCIA.png
ico_sizes = [16, 24, 32, 48, 64, 128, 256]
tile_1024.save(
    os.path.join(TAURI_ICONS_DIR, "icon.ico"),
    format="ICO",
    sizes=[(s, s) for s in ico_sizes]
)
print("Saved icon.ico with sizes:", ico_sizes)

# PNG icon sizes required by Tauri
png_sizes = {
    "32x32.png": 32,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
    "Square30x30Logo.png": 30,
    "Square44x44Logo.png": 44,
    "Square71x71Logo.png": 71,
    "Square89x89Logo.png": 89,
    "Square107x107Logo.png": 107,
    "Square142x142Logo.png": 142,
    "Square150x150Logo.png": 150,
    "Square284x284Logo.png": 284,
    "Square310x310Logo.png": 310,
    "StoreLogo.png": 50,
}

for name, sz in png_sizes.items():
    resized = tile_1024.resize((sz, sz), Image.Resampling.LANCZOS)
    resized.save(os.path.join(TAURI_ICONS_DIR, name))

print("All brand assets and Windows icons successfully built!")
