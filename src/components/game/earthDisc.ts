"use client";
import { asset } from "@/lib/asset";

/**
 * The real Earth as seen from orbit: the repo's equirectangular Earth + cloud maps projected orthographically.
 * The view looks down the normal of the launch orbit (due-east launch, inclination = latitude), so the launch site sits on the
 * rim at the top and eastward flight runs clockwise — exactly the 2-D frame the ascent simulation uses.
 */
const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const pixels = (img: HTMLImageElement) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d", { willReadFrequently: true })!; x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height); };

let texPromise: Promise<{ earth: ImageData; cloud: ImageData }> | null = null;
const textures = () => (texPromise ??= Promise.all([load(asset("/textures/earth.jpg")), load(asset("/textures/earth_clouds.png"))]).then(([e, c]) => ({ earth: pixels(e), cloud: pixels(c) })));

const cache = new Map<string, HTMLCanvasElement>();
export async function buildEarthDisc(latDeg: number, lonDeg: number, size = 640): Promise<HTMLCanvasElement | null> {
  const key = `${latDeg.toFixed(1)},${lonDeg.toFixed(1)},${size}`;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const { earth, cloud } = await textures();
    const out = document.createElement("canvas"); out.width = out.height = size;
    const ctx = out.getContext("2d")!, img = ctx.createImageData(size, size);
    const phi0 = ((Math.abs(latDeg) - 90) * Math.PI) / 180 * Math.sign(latDeg || 1), lam0 = (lonDeg * Math.PI) / 180;
    const sp0 = Math.sin(phi0), cp0 = Math.cos(phi0), R = size / 2;
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const x = (px + 0.5 - R) / R, y = (R - py - 0.5) / R, rho = Math.hypot(x, y);
        if (rho > 1) continue;
        const c = Math.asin(rho), sc = Math.sin(c), cc = Math.cos(c);
        const phi = rho === 0 ? phi0 : Math.asin(cc * sp0 + (y * sc * cp0) / rho);
        const lam = lam0 + (rho === 0 ? 0 : Math.atan2(x * sc, rho * cp0 * cc - y * sp0 * sc));
        let u = ((lam / (2 * Math.PI) + 0.5) % 1 + 1) % 1; const v = 0.5 - phi / Math.PI;
        const ei = (Math.min(earth.height - 1, Math.floor(v * earth.height)) * earth.width + Math.min(earth.width - 1, Math.floor(u * earth.width))) * 4;
        const ci = (Math.min(cloud.height - 1, Math.floor(v * cloud.height)) * cloud.width + Math.min(cloud.width - 1, Math.floor(u * cloud.width))) * 4;
        const ca = cloud.data[ci + 3] < 255 ? cloud.data[ci + 3] / 255 : (cloud.data[ci] + cloud.data[ci + 1] + cloud.data[ci + 2]) / 765;
        const k = 0.9 * Math.min(1, ca * 1.15), o = (py * size + px) * 4;
        img.data[o] = earth.data[ei] * (1 - k) + 250 * k; img.data[o + 1] = earth.data[ei + 1] * (1 - k) + 252 * k; img.data[o + 2] = earth.data[ei + 2] * (1 - k) + 255 * k; img.data[o + 3] = 255;
        u = 0;
      }
    }
    ctx.putImageData(img, 0, 0);
    cache.set(key, out);
    return out;
  } catch { return null; }
}
