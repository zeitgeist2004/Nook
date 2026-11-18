import React from 'react';
import { BackgroundDecorationsMode, ThemeId } from '../../types';

interface ThemeBackdropProps {
  theme: ThemeId | string;
  mode?: BackgroundDecorationsMode;
  isMobile?: boolean;
  hasActiveNote?: boolean;
}

/**
 * Generates an organic five-petal Japanese cherry blossom (sakura) SVG path centered at (cx, cy).
 */
function SakuraBlossom({
  cx,
  cy,
  scale = 1,
  rotation = 0,
  opacity = 0.24,
}: {
  cx: number;
  cy: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
}) {
  const petalAngles = [0, 72, 144, 216, 288];
  return (
    <g transform={`translate(${cx}, ${cy}) rotate(${rotation}) scale(${scale})`}>
      {petalAngles.map((deg) => (
        <path
          key={deg}
          d="M 0 -2 C -4 -9, -11 -17, -6 -24 C -3 -26, -1 -23, 0 -20.5 C 1 -23, 3 -26, 6 -24 C 11 -17, 4 -9, 0 -2 Z"
          transform={`rotate(${deg})`}
          fill="#E89EB8"
          fillOpacity={opacity}
          stroke="#F0B0C6"
          strokeOpacity={Math.min(0.55, opacity + 0.14)}
          strokeWidth="0.65"
        />
      ))}
      <circle cx="0" cy="0" r="2.7" fill="#F6EEF2" fillOpacity={Math.min(0.65, opacity + 0.25)} />
      {petalAngles.map((deg) => (
        <line
          key={`st-${deg}`}
          x1="0"
          y1="0"
          x2="0"
          y2="-6.5"
          transform={`rotate(${deg + 36})`}
          stroke="#F6EEF2"
          strokeOpacity={Math.min(0.5, opacity + 0.16)}
          strokeWidth="0.6"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

/**
 * Balanced, featherweight static SVG artwork for themed Nook workspaces (Neon & Sakura).
 *
 * Composition rule:
 * - Empty workspace (!hasActiveNote): full-canvas framing with unmistakable central & lateral personality.
 * - Active writing surface (hasActiveNote): smooth central readability mask dims middle column to ~0.04
 *   opacity while keeping soft edge/frame continuity so prose contrast stays strictly optimal.
 * - Pure static declarative SVG elements with pointer-events: none and zero script timers.
 */
const ThemeBackdropComponent: React.FC<ThemeBackdropProps> = ({
  theme,
  mode = 'subtle',
  isMobile = false,
  hasActiveNote = false,
}) => {
  if (mode === 'off') return null;

  const isNeon = theme === 'neon';
  const isSakura = theme === 'sakura' || theme === 'pink';

  if (!isNeon && !isSakura) return null;

  const baseScaleOpacity = isMobile ? (hasActiveNote ? 0.72 : 0.92) : hasActiveNote ? 0.88 : 1;

  if (isNeon) {
    return (
      <div
        aria-hidden="true"
        className="nook-theme-backdrop"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 0,
          opacity: baseScaleOpacity,
          transition: 'opacity 180ms ease-out',
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          style={{ display: 'block', width: '100%', height: '100%' }}
        >
          <defs>
            <pattern id="nook-neon-grid" width="36" height="36" patternUnits="userSpaceOnUse">
              <path
                d="M 36 0 L 0 0 0 36"
                stroke="#00FF9D"
                strokeOpacity={hasActiveNote ? '0.044' : '0.072'}
                strokeWidth="0.7"
              />
            </pattern>

            {/* Attenuates central reading column gently when a note is open while keeping identity visible */}
            <radialGradient id="nook-neon-center-mask-grad" cx="50%" cy="48%" r="58%">
              <stop offset="0%" stopColor="white" stopOpacity={hasActiveNote ? '0.38' : '0.95'} />
              <stop offset="46%" stopColor="white" stopOpacity={hasActiveNote ? '0.74' : '0.98'} />
              <stop offset="100%" stopColor="white" stopOpacity="1" />
            </radialGradient>

            <mask id="nook-neon-composition-mask">
              <rect width="1440" height="900" fill="url(#nook-neon-center-mask-grad)" />
            </mask>

            <radialGradient id="nook-neon-ambient-tl" cx="14%" cy="18%" r="36%">
              <stop offset="0%" stopColor="#00FF9D" stopOpacity="0.07" />
              <stop offset="100%" stopColor="#060908" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="nook-neon-ambient-br" cx="84%" cy="82%" r="40%">
              <stop offset="0%" stopColor="#00FF9D" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#060908" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="nook-neon-ambient-center" cx="50%" cy="46%" r="42%">
              <stop offset="0%" stopColor="#00FF9D" stopOpacity={hasActiveNote ? '0.035' : '0.075'} />
              <stop offset="100%" stopColor="#060908" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="1440" height="900" fill="url(#nook-neon-ambient-tl)" />
          <rect width="1440" height="900" fill="url(#nook-neon-ambient-br)" />
          <rect width="1440" height="900" fill="url(#nook-neon-ambient-center)" />

          <g mask="url(#nook-neon-composition-mask)">
            {/* Full-canvas subtle technical grid + major 180px sector guides */}
            <rect width="1440" height="900" fill="url(#nook-neon-grid)" />
            <path
              d="M 360 0 V 900 M 720 0 V 900 M 1080 0 V 900 M 0 225 H 1440 M 0 450 H 1440 M 0 675 H 1440"
              stroke="#00FF9D"
              strokeOpacity={hasActiveNote ? '0.055' : '0.095'}
              strokeWidth="0.75"
            />

            {/* Top-left cybersecurity bus routing inward */}
            <path
              d="M 0 112 L 164 112 L 222 170 L 388 170"
              stroke="#00FF9D"
              strokeOpacity="0.28"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 0 144 L 136 144 L 194 202 L 320 202 L 354 236"
              stroke="#00FF9D"
              strokeOpacity="0.18"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 96 0 L 96 76 L 142 122"
              stroke="#00FF9D"
              strokeOpacity="0.16"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Bottom-right PCB cluster reaching toward lower-mid & right margin */}
            <path
              d="M 1440 778 L 1168 778 L 1094 704 L 916 704"
              stroke="#00FF9D"
              strokeOpacity="0.28"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 1440 740 L 1222 740 L 1146 664 L 992 664 L 948 620"
              stroke="#00FF9D"
              strokeOpacity="0.18"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 1318 900 L 1318 684 L 1246 612 L 1148 612"
              stroke="#00FF9D"
              strokeOpacity="0.16"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Balanced mid-left & upper-right secondary signal lines */}
            <path
              d="M 0 564 L 112 564 L 164 512 L 268 512"
              stroke="#00FF9D"
              strokeOpacity="0.18"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 1440 264 L 1272 264 L 1206 330 L 1094 330"
              stroke="#00FF9D"
              strokeOpacity="0.20"
              strokeWidth="1.05"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Left-to-center & Right-to-center inward routing buses */}
            <path
              d="M 0 386 L 218 386 L 278 446 L 492 446"
              stroke="#00FF9D"
              strokeOpacity="0.30"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 136 354 L 232 354 L 292 414 L 456 414"
              stroke="#00FF9D"
              strokeOpacity="0.20"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 278 446 L 334 502 L 464 502"
              stroke="#00FF9D"
              strokeOpacity="0.22"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 1440 514 L 1222 514 L 1162 454 L 948 454"
              stroke="#00FF9D"
              strokeOpacity="0.30"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 1304 546 L 1208 546 L 1148 486 L 984 486"
              stroke="#00FF9D"
              strokeOpacity="0.20"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 1162 454 L 1106 398 L 976 398"
              stroke="#00FF9D"
              strokeOpacity="0.22"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Central PCB upper & lower bridges + HUD corner brackets around (720, 450) */}
            <path
              d="M 484 264 L 614 264 L 652 302 L 788 302 L 826 264 L 956 264"
              stroke="#00FF9D"
              strokeOpacity={hasActiveNote ? '0.17' : '0.29'}
              strokeWidth="1.15"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 484 636 L 614 636 L 652 598 L 788 598 L 826 636 L 956 636"
              stroke="#00FF9D"
              strokeOpacity={hasActiveNote ? '0.17' : '0.29'}
              strokeWidth="1.15"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 536 352 V 318 H 570 M 904 352 V 318 H 870 M 536 548 V 582 H 570 M 904 548 V 582 H 870"
              stroke="#00FF9D"
              strokeOpacity={hasActiveNote ? '0.20' : '0.35'}
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 720 156 V 224 M 720 676 V 744"
              stroke="#00FF9D"
              strokeOpacity={hasActiveNote ? '0.15' : '0.24'}
              strokeWidth="1"
              strokeLinecap="round"
            />

            {/* Terminal crosshair ticks */}
            <g stroke="#00FF9D" strokeOpacity={hasActiveNote ? '0.18' : '0.32'} strokeWidth="1.05">
              <path d="M 432 450 h 12 M 438 444 v 12" />
              <path d="M 996 450 h 12 M 1002 444 v 12" />
              <path d="M 714 142 h 12 M 720 136 v 12" />
              <path d="M 714 758 h 12 M 720 752 v 12" />
              <path d="M 594 450 h 12 M 600 444 v 12" />
              <path d="M 834 450 h 12 M 840 444 v 12" />
            </g>

            {/* Terminal connection pads / subtle luminous points */}
            <circle cx="388" cy="170" r="3.2" fill="#060908" stroke="#00FF9D" strokeOpacity="0.50" strokeWidth="1.25" />
            <circle cx="354" cy="236" r="2.5" fill="#00FF9D" fillOpacity="0.36" />
            <circle cx="268" cy="512" r="2.6" fill="#060908" stroke="#00FF9D" strokeOpacity="0.38" strokeWidth="1.1" />
            <circle cx="1094" cy="330" r="3" fill="#060908" stroke="#00FF9D" strokeOpacity="0.42" strokeWidth="1.2" />
            <circle cx="916" cy="704" r="3.4" fill="#060908" stroke="#00FF9D" strokeOpacity="0.50" strokeWidth="1.25" />
            <circle cx="948" cy="620" r="2.6" fill="#00FF9D" fillOpacity="0.36" />
            <circle cx="1148" cy="612" r="2.4" fill="#00FF9D" fillOpacity="0.30" />
            <circle cx="492" cy="446" r="3.1" fill="#060908" stroke="#00FF9D" strokeOpacity={hasActiveNote ? '0.32' : '0.56'} strokeWidth="1.25" />
            <circle cx="948" cy="454" r="3.1" fill="#060908" stroke="#00FF9D" strokeOpacity={hasActiveNote ? '0.32' : '0.56'} strokeWidth="1.25" />
            <circle cx="456" cy="414" r="2.3" fill="#00FF9D" fillOpacity={hasActiveNote ? '0.22' : '0.42'} />
            <circle cx="984" cy="486" r="2.3" fill="#00FF9D" fillOpacity={hasActiveNote ? '0.22' : '0.42'} />
            <circle cx="464" cy="502" r="2.2" fill="#00FF9D" fillOpacity={hasActiveNote ? '0.20' : '0.38'} />
            <circle cx="976" cy="398" r="2.2" fill="#00FF9D" fillOpacity={hasActiveNote ? '0.20' : '0.38'} />
            <circle cx="652" cy="302" r="2.5" fill="#00FF9D" fillOpacity={hasActiveNote ? '0.24' : '0.48'} />
            <circle cx="788" cy="302" r="2.5" fill="#00FF9D" fillOpacity={hasActiveNote ? '0.24' : '0.48'} />
            <circle cx="652" cy="598" r="2.5" fill="#00FF9D" fillOpacity={hasActiveNote ? '0.24' : '0.48'} />
            <circle cx="788" cy="598" r="2.5" fill="#00FF9D" fillOpacity={hasActiveNote ? '0.24' : '0.48'} />
            <circle cx="720" cy="224" r="2.6" fill="#060908" stroke="#00FF9D" strokeOpacity={hasActiveNote ? '0.26' : '0.48'} strokeWidth="1.15" />
            <circle cx="720" cy="676" r="2.6" fill="#060908" stroke="#00FF9D" strokeOpacity={hasActiveNote ? '0.26' : '0.48'} strokeWidth="1.15" />
          </g>
        </svg>
      </div>
    );
  }

  // Sakura Theme: Balanced Japanese minimalist cherry garden composition
  return (
    <div
      aria-hidden="true"
      className="nook-theme-backdrop"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
        opacity: baseScaleOpacity,
        transition: 'opacity 180ms ease-out',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <defs>
          <radialGradient id="nook-sakura-glow-tr" cx="84%" cy="16%" r="48%">
            <stop offset="0%" stopColor="#E89EB8" stopOpacity="0.11" />
            <stop offset="62%" stopColor="#E89EB8" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#161217" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nook-sakura-glow-bl" cx="16%" cy="82%" r="42%">
            <stop offset="0%" stopColor="#E89EB8" stopOpacity="0.085" />
            <stop offset="100%" stopColor="#161217" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nook-sakura-glow-center" cx="50%" cy="46%" r="44%">
            <stop offset="0%" stopColor="#E89EB8" stopOpacity={hasActiveNote ? '0.045' : '0.095'} />
            <stop offset="100%" stopColor="#161217" stopOpacity="0" />
          </radialGradient>

          {/* Soft center vignette preserves legibility while writing, lifts gracefully when empty */}
          <radialGradient id="nook-sakura-center-mask-grad" cx="50%" cy="48%" r="54%">
            <stop offset="0%" stopColor="white" stopOpacity={hasActiveNote ? '0.40' : '0.95'} />
            <stop offset="48%" stopColor="white" stopOpacity={hasActiveNote ? '0.76' : '0.98'} />
            <stop offset="100%" stopColor="white" stopOpacity="1" />
          </radialGradient>
          <mask id="nook-sakura-composition-mask">
            <rect width="1440" height="900" fill="url(#nook-sakura-center-mask-grad)" />
          </mask>
        </defs>

        <rect width="1440" height="900" fill="url(#nook-sakura-glow-tr)" />
        <rect width="1440" height="900" fill="url(#nook-sakura-glow-bl)" />
        <rect width="1440" height="900" fill="url(#nook-sakura-glow-center)" />

        <g mask="url(#nook-sakura-composition-mask)">
          {/* Upper-right sweeping cherry branch */}
          <path
            d="M 1456 54 C 1348 84, 1244 134, 1140 206 C 1072 254, 1018 292, 954 328"
            stroke="#7E5C6B"
            strokeOpacity="0.48"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <path
            d="M 1272 122 C 1236 88, 1200 58, 1152 38"
            stroke="#7E5C6B"
            strokeOpacity="0.38"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path
            d="M 1184 176 C 1202 222, 1224 264, 1252 302"
            stroke="#7E5C6B"
            strokeOpacity="0.34"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M 1074 252 C 1026 244, 982 246, 938 260"
            stroke="#7E5C6B"
            strokeOpacity="0.30"
            strokeWidth="1.35"
            strokeLinecap="round"
          />

          {/* Lower-left complementary secondary bough */}
          <path
            d="M -16 816 C 92 778, 186 734, 278 672 C 328 638, 368 608, 414 584"
            stroke="#7E5C6B"
            strokeOpacity="0.44"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M 164 742 C 186 696, 206 660, 238 632"
            stroke="#7E5C6B"
            strokeOpacity="0.32"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M 274 674 C 316 688, 356 692, 396 684"
            stroke="#7E5C6B"
            strokeOpacity="0.28"
            strokeWidth="1.25"
            strokeLinecap="round"
          />

          {/* Upper-left & Lower-right inward-reaching branches framing center field */}
          <path
            d="M -14 214 C 128 238, 274 282, 434 348 C 492 372, 544 390, 594 402"
            stroke="#8A6475"
            strokeOpacity="0.40"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <path
            d="M 286 286 C 338 246, 392 222, 456 208"
            stroke="#8A6475"
            strokeOpacity="0.32"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M 1454 696 C 1316 668, 1178 624, 1028 562 C 972 538, 922 520, 872 508"
            stroke="#8A6475"
            strokeOpacity="0.38"
            strokeWidth="2.0"
            strokeLinecap="round"
          />
          <path
            d="M 1156 616 C 1108 654, 1056 676, 996 688"
            stroke="#8A6475"
            strokeOpacity="0.30"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* Organic central Japanese garden framing curves around (720, 450) */}
          <path
            d="M 446 284 C 578 198, 862 198, 994 288"
            stroke="#E89EB8"
            strokeOpacity={hasActiveNote ? '0.15' : '0.28'}
            strokeWidth="1.15"
            strokeLinecap="round"
          />
          <path
            d="M 462 612 C 594 694, 846 694, 978 608"
            stroke="#E89EB8"
            strokeOpacity={hasActiveNote ? '0.15' : '0.28'}
            strokeWidth="1.15"
            strokeLinecap="round"
          />
          <path
            d="M 388 476 C 542 368, 898 532, 1052 424"
            stroke="#E89EB8"
            strokeOpacity={hasActiveNote ? '0.11' : '0.22'}
            strokeWidth="1.0"
            strokeDasharray="4 9"
            strokeLinecap="round"
          />

          {/* Primary blossoms along upper-right branch */}
          <SakuraBlossom cx={1308} cy={104} scale={0.95} rotation={16} opacity={0.30} />
          <SakuraBlossom cx={1214} cy={156} scale={1.08} rotation={-12} opacity={0.32} />
          <SakuraBlossom cx={1166} cy={46} scale={0.74} rotation={38} opacity={0.25} />
          <SakuraBlossom cx={1114} cy={222} scale={0.86} rotation={24} opacity={0.28} />
          <SakuraBlossom cx={976} cy={314} scale={0.68} rotation={-26} opacity={0.24} />
          <SakuraBlossom cx={1242} cy={284} scale={0.64} rotation={52} opacity={0.22} />

          {/* Blossoms along bottom-left branch */}
          <SakuraBlossom cx={148} cy={748} scale={0.92} rotation={-18} opacity={0.28} />
          <SakuraBlossom cx={256} cy={682} scale={0.84} rotation={22} opacity={0.27} />
          <SakuraBlossom cx={232} cy={636} scale={0.62} rotation={-40} opacity={0.22} />
          <SakuraBlossom cx={386} cy={596} scale={0.60} rotation={12} opacity={0.21} />

          {/* Blossoms along inward mid-canvas branches */}
          <SakuraBlossom cx={176} cy={246} scale={0.82} rotation={18} opacity={0.28} />
          <SakuraBlossom cx={322} cy={298} scale={0.76} rotation={-16} opacity={0.28} />
          <SakuraBlossom cx={448} cy={212} scale={0.68} rotation={26} opacity={0.26} />
          <SakuraBlossom cx={466} cy={362} scale={0.78} rotation={-24} opacity={0.30} />
          <SakuraBlossom cx={578} cy={398} scale={0.66} rotation={14} opacity={hasActiveNote ? 0.22 : 0.30} />
          <SakuraBlossom cx={1264} cy={650} scale={0.84} rotation={-20} opacity={0.28} />
          <SakuraBlossom cx={1116} cy={598} scale={0.76} rotation={24} opacity={0.28} />
          <SakuraBlossom cx={1004} cy={684} scale={0.68} rotation={-30} opacity={0.26} />
          <SakuraBlossom cx={978} cy={542} scale={0.78} rotation={12} opacity={0.30} />
          <SakuraBlossom cx={886} cy={512} scale={0.66} rotation={-14} opacity={hasActiveNote ? 0.22 : 0.30} />

          {/* Central ring cherry blossoms framing empty mascot & center field */}
          <SakuraBlossom cx={552} cy={236} scale={0.84} rotation={12} opacity={hasActiveNote ? 0.20 : 0.33} />
          <SakuraBlossom cx={718} cy={204} scale={0.78} rotation={-18} opacity={hasActiveNote ? 0.20 : 0.33} />
          <SakuraBlossom cx={884} cy={238} scale={0.82} rotation={22} opacity={hasActiveNote ? 0.20 : 0.33} />
          <SakuraBlossom cx={618} cy={340} scale={0.70} rotation={-26} opacity={hasActiveNote ? 0.19 : 0.32} />
          <SakuraBlossom cx={828} cy={350} scale={0.68} rotation={32} opacity={hasActiveNote ? 0.19 : 0.32} />
          <SakuraBlossom cx={612} cy={556} scale={0.70} rotation={20} opacity={hasActiveNote ? 0.19 : 0.32} />
          <SakuraBlossom cx={832} cy={548} scale={0.72} rotation={-22} opacity={hasActiveNote ? 0.19 : 0.32} />
          <SakuraBlossom cx={556} cy={646} scale={0.80} rotation={36} opacity={hasActiveNote ? 0.20 : 0.33} />
          <SakuraBlossom cx={724} cy={684} scale={0.76} rotation={-12} opacity={hasActiveNote ? 0.20 : 0.33} />
          <SakuraBlossom cx={888} cy={642} scale={0.80} rotation={16} opacity={hasActiveNote ? 0.20 : 0.33} />

          {/* Delicate pink flower buds */}
          <ellipse cx="944" cy="258" rx="5" ry="2.8" transform="rotate(-18 944 258)" fill="#E89EB8" fillOpacity="0.28" />
          <ellipse cx="1262" cy="312" rx="4.6" ry="2.6" transform="rotate(62 1262 312)" fill="#E89EB8" fillOpacity="0.26" />
          <ellipse cx="398" cy="684" rx="4.8" ry="2.6" transform="rotate(-8 398 684)" fill="#E89EB8" fillOpacity="0.26" />
          <ellipse cx="596" cy="404" rx="4.6" ry="2.5" transform="rotate(14 596 404)" fill="#E89EB8" fillOpacity={hasActiveNote ? '0.18' : '0.28'} />
          <ellipse cx="870" cy="508" rx="4.6" ry="2.5" transform="rotate(-14 870 508)" fill="#E89EB8" fillOpacity={hasActiveNote ? '0.18' : '0.28'} />

          {/* Gentle floating cherry petals across central field & lateral margins */}
          <path d="M 526 286 C 520 280, 523 270, 532 272 C 537 276, 534 286, 526 286 Z" fill="#E89EB8" fillOpacity={hasActiveNote ? '0.16' : '0.32'} />
          <path d="M 664 252 C 658 247, 661 238, 669 240 C 674 244, 670 252, 664 252 Z" fill="#F0B0C6" fillOpacity={hasActiveNote ? '0.16' : '0.30'} />
          <path d="M 812 296 C 806 291, 809 282, 817 284 C 821 288, 818 296, 812 296 Z" fill="#F0B0C6" fillOpacity={hasActiveNote ? '0.16' : '0.30'} />
          <path d="M 922 396 C 916 391, 919 382, 927 384 C 932 388, 928 396, 922 396 Z" fill="#E89EB8" fillOpacity={hasActiveNote ? '0.16' : '0.30'} />
          <path d="M 512 456 C 506 451, 509 442, 517 444 C 522 448, 518 456, 512 456 Z" fill="#F0B0C6" fillOpacity={hasActiveNote ? '0.16' : '0.31'} />
          <path d="M 652 624 C 646 619, 649 610, 657 612 C 662 616, 658 624, 652 624 Z" fill="#E89EB8" fillOpacity={hasActiveNote ? '0.16' : '0.29'} />
          <path d="M 792 612 C 786 607, 789 598, 797 600 C 802 604, 798 612, 792 612 Z" fill="#F0B0C6" fillOpacity={hasActiveNote ? '0.16' : '0.30'} />
          <path d="M 884 704 C 878 699, 881 690, 889 692 C 894 696, 890 704, 884 704 Z" fill="#E89EB8" fillOpacity={hasActiveNote ? '0.16' : '0.28'} />
          <path d="M 1032 648 C 1025 643, 1028 632, 1038 634 C 1043 638, 1040 649, 1032 648 Z" fill="#E89EB8" fillOpacity="0.24" />
          <path d="M 328 364 C 322 359, 325 350, 333 352 C 338 356, 335 364, 328 364 Z" fill="#F0B0C6" fillOpacity="0.22" />
          <path d="M 1148 446 C 1142 440, 1145 431, 1154 433 C 1158 437, 1155 446, 1148 446 Z" fill="#E89EB8" fillOpacity="0.24" />
        </g>
      </svg>
    </div>
  );
};

export const ThemeBackdrop = React.memo(ThemeBackdropComponent);
