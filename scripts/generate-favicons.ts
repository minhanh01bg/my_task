import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SVG_CONTENT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#022c22" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Squircle Base -->
  <rect x="20" y="20" width="472" height="472" rx="112" fill="url(#bgGrad)"/>
  <rect x="20" y="20" width="472" height="472" rx="112" fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="4"/>

  <!-- Store Emblem -->
  <g filter="url(#shadow)">
    <!-- Awning Canopy -->
    <path d="M110 196 L134 116 C136 108 144 102 153 102 L359 102 C368 102 376 108 378 116 L402 196 Z" fill="#ffffff"/>

    <!-- Awning Scallops -->
    <path d="M110 196 C110 216 128 228 146 228 C164 228 180 216 180 196 Z" fill="#047857"/>
    <path d="M180 196 C180 216 198 228 218 228 C238 228 256 216 256 196 Z" fill="#ffffff"/>
    <path d="M256 196 C256 216 274 228 294 228 C314 228 332 216 332 196 Z" fill="#047857"/>
    <path d="M332 196 C332 216 350 228 368 228 C386 228 402 216 402 196 Z" fill="#ffffff"/>

    <!-- Store Base -->
    <rect x="130" y="228" width="252" height="170" rx="16" fill="#ffffff"/>

    <!-- Doorway -->
    <rect x="216" y="280" width="80" height="118" rx="10" fill="#047857"/>
    <circle cx="282" cy="340" r="4.5" fill="#f0fdf4"/>

    <!-- Display Windows -->
    <rect x="150" y="260" width="50" height="66" rx="8" fill="#10B981" fill-opacity="0.2" stroke="#047857" stroke-width="4"/>
    <line x1="175" y1="260" x2="175" y2="326" stroke="#047857" stroke-width="3"/>

    <rect x="312" y="260" width="50" height="66" rx="8" fill="#10B981" fill-opacity="0.2" stroke="#047857" stroke-width="4"/>
    <line x1="337" y1="260" x2="337" y2="326" stroke="#047857" stroke-width="3"/>

    <!-- Sparkle / Star of Excellence -->
    <path d="M400 80 Q410 102 432 112 Q410 122 400 144 Q390 122 368 112 Q390 102 400 80 Z" fill="#FDE047"/>
  </g>
</svg>`;

async function main() {
  const root = process.cwd();
  const srcApp = path.join(root, "src", "app");
  const pub = path.join(root, "public");

  const svgBuffer = Buffer.from(SVG_CONTENT, "utf-8");

  // 1. Write SVG icons
  fs.writeFileSync(path.join(srcApp, "icon.svg"), SVG_CONTENT, "utf-8");
  fs.writeFileSync(path.join(pub, "icon.svg"), SVG_CONTENT, "utf-8");
  console.log("Wrote icon.svg");

  // 2. Generate PNGs: 32x32, 192x192, 512x512, apple-icon 180x180
  const png32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  const png180 = await sharp(svgBuffer).resize(180, 180).png().toBuffer();
  const png192 = await sharp(svgBuffer).resize(192, 192).png().toBuffer();
  const png512 = await sharp(svgBuffer).resize(512, 512).png().toBuffer();

  fs.writeFileSync(path.join(srcApp, "apple-icon.png"), png180);
  fs.writeFileSync(path.join(pub, "apple-icon.png"), png180);
  fs.writeFileSync(path.join(pub, "icon-192.png"), png192);
  fs.writeFileSync(path.join(pub, "icon-512.png"), png512);
  console.log("Generated PNG app icons and apple-icon.png");

  // 3. Write favicon.ico (Next.js accepts PNG-in-ICO or standard 32x32)
  fs.writeFileSync(path.join(srcApp, "favicon.ico"), png32);
  fs.writeFileSync(path.join(pub, "favicon.ico"), png32);
  console.log("Updated favicon.ico with new brand icon");
}

main().catch(console.error);
