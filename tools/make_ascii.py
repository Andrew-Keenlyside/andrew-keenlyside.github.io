"""Build the ASCII renders used on the site from public HiP-CT data.

Sources (Human Organ Atlas, CC BY 4.0), read straight from the public bucket:
  S-21-46 whole brain, 19.57 um, BM18   doi:10.15151/ESRF-DC-2222698126  (hero sweep)

Writes assets/ascii/hero.json, then pastes the middle-ish frame into
index.html between <!--ascii:NAME--> markers so the page
shows them without JavaScript. A render is a string of rows joined by "\n";
a space means no tissue.

    python tools/make_ascii.py   # needs numcodecs, scipy, scikit-image, pillow
"""

import json
import re
import struct
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numcodecs
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage import exposure, filters, morphology

BUCKET = "https://storage.googleapis.com/ucl-hip-ct-35a68e99feaae8932b1d44da0358940b/"
SITE = Path(__file__).resolve().parent.parent
OUT = SITE / "assets" / "ascii"
RAMP = ".,:;-=+*oxO%#@"  # faint to dense; index 0 is the faintest tissue glyph
CHAR_ASPECT = 0.5  # glyph advance / line height: 0.6em advance at line-height 1.2


def read_n5(path: str) -> np.ndarray:
    """Whole N5 scale level (blosc, uint16) as a (z, y, x) array."""
    base = BUCKET + path.rstrip("/")
    att = json.load(urllib.request.urlopen(base + "/attributes.json"))
    dims, bs = att["dimensions"], att["blockSize"]
    vol = np.zeros(dims[::-1], dtype=np.uint16)
    codec = numcodecs.Blosc()

    def block(ijk: tuple[int, int, int]) -> None:
        i, j, k = ijk
        try:
            raw = urllib.request.urlopen(f"{base}/{i}/{j}/{k}").read()
        except Exception:
            return  # absent block = empty
        mode, nd = struct.unpack(">HH", raw[:4])
        bd = struct.unpack(">" + "I" * nd, raw[4 : 4 + 4 * nd])
        off = 4 + 4 * nd + (4 if mode == 1 else 0)
        a = np.frombuffer(codec.decode(raw[off:]), dtype=">u2")[: int(np.prod(bd))].reshape(bd[::-1])
        dst = vol[k * bs[2] : k * bs[2] + bd[2], j * bs[1] : j * bs[1] + bd[1], i * bs[0] : i * bs[0] + bd[0]]
        dst[...] = a[: dst.shape[0], : dst.shape[1], : dst.shape[2]]

    n = [-(-d // b) for d, b in zip(dims, bs)]
    with ThreadPoolExecutor(16) as ex:
        list(ex.map(block, [(i, j, k) for i in range(n[0]) for j in range(n[1]) for k in range(n[2])]))
    return vol


def tissue_mask(img: np.ndarray, min_size: int) -> np.ndarray:
    """Tissue = bright classes, opened, keeping only components near the size of the largest."""
    sm = filters.gaussian(img, 1.5, preserve_range=True)
    m = sm > filters.threshold_multiotsu(sm, classes=3)[0]
    m = ndi.binary_opening(m, iterations=2)
    lab, n = ndi.label(m)
    if n == 0:
        return m
    sizes = ndi.sum(m, lab, range(1, n + 1))
    keep = [i + 1 for i, sz in enumerate(sizes) if sz >= max(min_size, 0.05 * sizes.max())]
    return np.isin(lab, keep)


def to_levels(img: np.ndarray, mask: np.ndarray, lo: float, hi: float, local: bool = True) -> np.ndarray:
    v = np.clip((img - lo) / (hi - lo), 0, 1)
    if local:  # local contrast helps whole-organ slices; it flattens bright-bundle vs dark-grey contrast
        v = exposure.equalize_adapthist(v, clip_limit=0.01)
    if mask.any():  # stretch the tissue's own range so grey and white matter use the whole ramp
        a, b = np.percentile(v[mask], [3, 99.5])
        v = np.clip((v - a) / max(b - a, 1e-6), 0, 1)
    return np.where(mask, v, np.nan)


def render(levels: np.ndarray, cols: int, blank_below: float = 0.0) -> str:
    """Area-average a float image (nan = empty) onto a cols-wide character grid."""
    h, w = levels.shape
    rows = max(1, round(cols * (h / w) * CHAR_ASPECT))
    cover = (~np.isnan(levels)).astype(np.float32)
    s = np.asarray(Image.fromarray(np.nan_to_num(levels, nan=0.0).astype(np.float32)).resize((cols, rows), Image.BOX))
    c = np.asarray(Image.fromarray(cover).resize((cols, rows), Image.BOX))
    val = np.divide(s, c, out=np.zeros_like(s), where=c > 0)
    idx = np.clip((val * len(RAMP)).astype(int), 0, len(RAMP) - 1)
    chars = np.array(list(RAMP))[idx]
    chars[c < 0.45] = " "
    if blank_below:
        chars[(val < blank_below) & (c >= 0.45)] = " "
    return "\n".join("".join(r).rstrip() for r in chars)


def hero() -> dict:
    """Sagittal sweep through the S-21-46 whole brain (level s4 = 313 um voxels)."""
    vol = read_n5("S-21-46/brain/19.57um_complete-organ_bm18/s4").astype(np.float32)  # (z, y, x)
    # sagittal plane = fixed x; rotate so superior is up and anterior is left
    sl = lambda x: np.rot90(vol[:, :, x], k=-1)
    masks_all = {x: tissue_mask(sl(x), 300) for x in range(vol.shape[2])}
    areas = {x: m.sum() for x, m in masks_all.items()}
    xs = [x for x, a in areas.items() if a > 0.3 * max(areas.values())]
    picks = np.linspace(xs[0], xs[-1], 48).round().astype(int)
    union = np.any(np.stack([masks_all[x] for x in picks]), axis=0)
    r, c = np.where(union)
    pad = 4
    box = (slice(max(r.min() - pad, 0), r.max() + pad), slice(max(c.min() - pad, 0), c.max() + pad))
    tissue = np.concatenate([sl(x)[masks_all[x]] for x in picks[::6]])
    lo, hi = np.percentile(tissue, [1, 99.7])
    out = {"voxel_um": 19.57, "shown_um": round(19.57 * 16, 1), "slices": [int(x) for x in picks], "of": int(vol.shape[2])}
    for cols in (176, 120, 72):
        out[str(cols)] = [render(to_levels(sl(x)[box], masks_all[x][box], lo, hi), cols) for x in picks]
    return out


def paste(html: str, name: str, text: str) -> str:
    pat = re.compile(rf"(<!--ascii:{name}-->).*?(<!--/ascii:{name}-->)", re.S)
    return pat.sub(lambda m: m.group(1) + text + m.group(2), html)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    h = hero()
    (OUT / "hero.json").write_text(json.dumps(h, separators=(",", ":")))
    page = SITE / "index.html"
    if page.exists():
        html = page.read_text()
        html = paste(html, "hero", h["120"][round(len(h["120"]) * 0.3)])
        page.write_text(html)
    for f in OUT.glob("*.json"):
        print(f.name, f.stat().st_size // 1024, "KB")
    print("hero rows", h["120"][0].count("\n") + 1)


if __name__ == "__main__":
    main()
