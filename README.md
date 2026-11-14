# andrew-keenlyside.github.io

Personal academic website for Andrew Keenlyside.

**[andrew-keenlyside.github.io](https://andrew-keenlyside.github.io)**

Plain static HTML, CSS and JavaScript with no build step, served by GitHub Pages from the repository root.

## Brain render

The hero animation is public HiP-CT data from the [Human Organ Atlas](https://human-organ-atlas.esrf.fr) (CC BY 4.0): donor S-21-46, whole brain, 19.57 µm, ESRF BM18, [doi:10.15151/ESRF-DC-2222698126](https://doi.org/10.15151/ESRF-DC-2222698126), rendered as text.

To regenerate `assets/ascii/hero.json` and the static frame pasted into `index.html`:

```sh
python tools/make_ascii.py   # numcodecs, scipy, scikit-image, pillow
```

Fonts (Schibsted Grotesk, Geist Mono) are self-hosted from Google Fonts under the SIL Open Font License.
