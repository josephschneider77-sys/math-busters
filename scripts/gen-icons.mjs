import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync("public/favicon.svg");
mkdirSync("public/icons", { recursive: true });

async function make(size, out, pad = 0) {
  if (pad) {
    const bg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#4a0a7a"/></svg>`,
    );
    const icon = await sharp(svg)
      .resize(size - pad * 2, size - pad * 2)
      .png()
      .toBuffer();
    await sharp(bg)
      .composite([{ input: icon, left: pad, top: pad }])
      .png()
      .toFile(out);
  } else {
    await sharp(svg).resize(size, size).png().toFile(out);
  }
  console.log("wrote", out);
}

await make(180, "public/apple-touch-icon.png");
await make(192, "public/icons/icon-192.png");
await make(512, "public/icons/icon-512.png");
await make(192, "public/icons/icon-192-maskable.png", 18);
await make(512, "public/icons/icon-512-maskable.png", 48);
