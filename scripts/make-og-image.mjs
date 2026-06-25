// Generates the social-share (Open Graph) image used as the link thumbnail on
// WhatsApp, iMessage, Slack, etc. WhatsApp ignores transparency (renders it as
// black) and crops/scales odd ratios, so we bake the brand logo onto a solid
// 1200x630 canvas — the ratio every scraper expects.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const WIDTH = 1200;
const HEIGHT = 630;
const BG = "#faf8f4"; // brand cream (matches the site background)
const LOGO_TARGET_W = 760; // leaves comfortable padding on the 1200px canvas

const logoPath = join(root, "public", "brand-logo.png");
const outPath = join(root, "public", "og-image.png");

const logo = await sharp(logoPath)
  .resize({ width: LOGO_TARGET_W })
  .toBuffer();

const { height: logoH } = await sharp(logo).metadata();

await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: BG,
  },
})
  .composite([
    {
      input: logo,
      top: Math.round((HEIGHT - logoH) / 2),
      left: Math.round((WIDTH - LOGO_TARGET_W) / 2),
    },
  ])
  .png()
  .toFile(outPath);

console.log(`Wrote ${outPath} (${WIDTH}x${HEIGHT})`);
