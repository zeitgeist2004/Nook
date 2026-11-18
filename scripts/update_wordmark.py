import os
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND_DIR = os.path.join(BASE_DIR, "assets", "brand")
PUBLIC_DIR = os.path.join(BASE_DIR, "public", "brand")

with open(os.path.join(BRAND_DIR, "nook-wordmark.svg"), "r", encoding="utf-8") as f:
    old_wm = f.read()

paths = re.findall(r'<path d="([^"]+)"', old_wm)

head_d = "M 100.00 50.00 C 92.67 50.00, 85.00 32.00, 78.00 26.00 C 71.00 20.00, 64.33 14.33, 58.00 14.00 C 51.67 13.67, 45.33 17.00, 40.00 24.00 C 34.67 31.00, 29.33 44.00, 26.00 56.00 C 22.67 68.00, 20.00 84.33, 20.00 96.00 C 20.00 107.67, 20.67 117.33, 26.00 126.00 C 31.33 134.67, 39.67 143.00, 52.00 148.00 C 64.33 153.00, 84.00 156.00, 100.00 156.00 C 116.00 156.00, 135.67 153.00, 148.00 148.00 C 160.33 143.00, 168.67 134.67, 174.00 126.00 C 179.33 117.33, 180.00 107.67, 180.00 96.00 C 180.00 84.33, 177.33 68.00, 174.00 56.00 C 170.67 44.00, 165.33 31.00, 160.00 24.00 C 154.67 17.00, 148.33 13.67, 142.00 14.00 C 135.67 14.33, 129.00 20.00, 122.00 26.00 C 115.00 32.00, 107.33 50.00, 100.00 50.00 Z"

# The letters are paths[4] to paths[7]
# Scaled head in wordmark
# ViewBox 0 0 630 220
# Head at x=15, y=15

new_wm = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 630 220" fill="none">
  <!-- Nook Mark -->
  <g transform="translate(15, 15)">
    <path d="{head_d}" fill="#ECEAE5" />
    <ellipse cx="73" cy="95" rx="8" ry="12" fill="#171717" />
    <ellipse cx="127" cy="95" rx="8" ry="12" fill="#171717" />
    <path d="M 88 109 Q 100 121 112 109" stroke="#171717" stroke-width="5" stroke-linecap="round" fill="none" />
  </g>
  <!-- Wordmark 'Nook' -->
  <path d="{paths[4]}" fill="#ECEAE5" />
  <path d="{paths[5]}" fill-rule="evenodd" fill="#ECEAE5" />
  <path d="{paths[6]}" fill-rule="evenodd" fill="#ECEAE5" />
  <path d="{paths[7]}" fill="#ECEAE5" />
</svg>"""

with open(os.path.join(BRAND_DIR, "nook-wordmark.svg"), "w", encoding="utf-8") as f:
    f.write(new_wm)
with open(os.path.join(PUBLIC_DIR, "nook-wordmark.svg"), "w", encoding="utf-8") as f:
    f.write(new_wm)
print("Updated nook-wordmark.svg successfully!")
