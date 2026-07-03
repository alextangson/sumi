#!/usr/bin/env python3
"""Pack a concept transformation into ONE self-contained morph sand-painting HTML.

Given two states (a "before" and an "after"), generate two monochrome ink
reference images with gpt-image-1, particle-ize them, and emit a single HTML
file with sumi + both images inlined — no server, no external deps, double-click
to run, droppable into any deck/page.

The particle-friendly ink STYLE recipe is baked in; you only describe WHAT each
state depicts (the subject) + its short label.

Usage (generate images):
  OPENAI_API_KEY=... python3 pack.py \
    --a-label 混乱 --a-desc "a chaotic tangle of overlapping ink scribbles and knots" \
    --b-label 秩序 --b-desc "five thick evenly-spaced aligned horizontal bars" \
    --out chaos.html

Usage (reuse existing images, no API cost):
  python3 pack.py --a-label 各自为战 --b-label 协同 \
    --a-img refs/silo-A.png --b-img refs/silo-B.png --out silo.html
"""
import argparse, os, sys, json, base64, subprocess, tempfile, shutil
import urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
SUMI = os.path.normpath(os.path.join(HERE, "..", "..", "..", "skill", "assets", "sumi.global.js"))
TEMPLATE = os.path.join(HERE, "template.html")

# The particle-friendly ink recipe (learned in lab/concept-brain/EVAL.md): pure
# black/white, bold solid masses, no fine detail — dissolves into rich ink stipple.
PREFIX = "A minimalist monochrome sumi ink illustration on plain white. "
COMMON = ("Flat PURE black on PURE white, hand-inked brushy edges, no gradients, no grey, "
          "no shading, no texture, no text, no color, no border. Bold solid shapes, clean, "
          "generous negative space. Square 1:1 composition.")


def gen_image(desc, out_png):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        sys.exit("error: set OPENAI_API_KEY to generate images (or pass --a-img/--b-img).")
    prompt = PREFIX + desc + " " + COMMON
    body = json.dumps({"model": "gpt-image-1", "prompt": prompt,
                       "size": "1024x1024", "quality": "medium", "n": 1}).encode()
    req = urllib.request.Request("https://api.openai.com/v1/images/generations", data=body,
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            d = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"error: gpt-image-1 HTTP {e.code}: {e.read()[:300]}")
    with open(out_png, "wb") as f:
        f.write(base64.b64decode(d["data"][0]["b64_json"]))


def downscale(png, px=720):
    """Shrink to keep the inlined HTML lean. macOS `sips`; best-effort no-op otherwise."""
    try:
        subprocess.run(["sips", "-Z", str(px), png], check=True, capture_output=True)
    except Exception:
        pass


def data_uri(png):
    return "data:image/png;base64," + base64.b64encode(open(png, "rb").read()).decode()


def main():
    ap = argparse.ArgumentParser(description="Pack a concept morph into one self-contained HTML.")
    ap.add_argument("--a-label", required=True, help="left/before caption, e.g. 混乱")
    ap.add_argument("--b-label", required=True, help="right/after caption, e.g. 秩序")
    ap.add_argument("--a-desc", help="what state A depicts (subject only; style is baked in)")
    ap.add_argument("--b-desc", help="what state B depicts")
    ap.add_argument("--a-img", help="use this existing PNG for A instead of generating")
    ap.add_argument("--b-img", help="use this existing PNG for B instead of generating")
    ap.add_argument("--out", required=True, help="output HTML path")
    ap.add_argument("--n", type=int, default=14000, help="particle count (default 14000)")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--keep-size", action="store_true", help="don't downscale the inlined images")
    a = ap.parse_args()

    tmp = tempfile.mkdtemp()
    try:
        A, B = os.path.join(tmp, "a.png"), os.path.join(tmp, "b.png")
        if a.a_img:
            shutil.copy(a.a_img, A)
        elif a.a_desc:
            gen_image(a.a_desc, A)
        else:
            sys.exit("error: need --a-desc (to generate) or --a-img (to reuse).")
        if a.b_img:
            shutil.copy(a.b_img, B)
        elif a.b_desc:
            gen_image(a.b_desc, B)
        else:
            sys.exit("error: need --b-desc (to generate) or --b-img (to reuse).")

        if not a.keep_size:
            downscale(A); downscale(B)

        sumi = open(SUMI, encoding="utf-8").read()
        html = open(TEMPLATE, encoding="utf-8").read()
        html = (html
                .replace("__LABEL_A__", a.a_label).replace("__LABEL_B__", a.b_label)
                .replace("__N__", str(a.n)).replace("__SEED__", str(a.seed))
                .replace("__IMG_A__", data_uri(A)).replace("__IMG_B__", data_uri(B))
                .replace("__SUMI_JS__", sumi))
        with open(a.out, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"wrote {a.out} ({os.path.getsize(a.out)//1024} KB, self-contained)")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
