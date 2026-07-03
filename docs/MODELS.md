# Zephyr — Model Guide & Ratings

Reference for the models wired into Zephyr (video · image · voice): what each is
best at, and 1–10 ratings per capability.

> Scores are calibrated estimates from each model family's known strengths and
> current public comparisons — **not** lab benchmarks. `—` = capability not
> offered. Several entries are bleeding-edge versions (Veo 3.1, Sora 2, Kling o3,
> Seedance 2.0, FLUX 2, Nano Banana 2, GPT Image 2…) rated by family strengths;
> confirm on real jobs once the fal balance is topped up.
>
> _Last updated 2026-07-03._

---

## Ratings (out of 10)

### 🎬 Video

| Model | Realism | Physics | Motion | Camera | Audio | Consistency | Prompt | Gen Speed |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Veo 3.1** | 10 | 8 | 8 | 9 | 10 | 8 | 9 | 5 |
| **Sora 2 Pro** | 9 | 10 | 9 | 8 | 8 | 8 | 9 | 4 |
| **Seedance 2.0** | 8 | 8 | 9 | 7 | 9 | 10 | 8 | 6 |
| **Seedance 2.0 Fast** | 7 | 7 | 8 | 7 | 8 | 9 | 8 | 8 |
| **Seedance 2.0 Mini** | 6 | 6 | 7 | 6 | 7 | 8 | 7 | 9 |
| **Kling o3 Pro** | 9 | 8 | 9 | 10 | — | 9 | 9 | 5 |
| **Kling 3.0 Pro** | 8 | 8 | 8 | 8 | 8 | 7 | 8 | 6 |
| **Kling 3.0 Standard** | 7 | 7 | 7 | 7 | — | 7 | 7 | 7 |
| **Hailuo 2.3 Pro** | 8 | 7 | 10 | 8 | — | 6 | 7 | 6 |
| **Grok Imagine** | 6 | 5 | 6 | 5 | 6 | 5 | 6 | 8 |
| **Gemini Omni Flash** | 6 | 6 | 6 | 5 | 7 | 5 | 6 | 9 |

**Lip-sync specialists** (different job, scored on their own terms):

- **OmniHuman** — lip-sync accuracy **9**, talking-head realism **8**, expression **8**
- **Kling LipSync** — lip-sync accuracy **9**, video realism preserved **7**, ease **8**

### 🖼️ Image

| Model | Realism | Text | Editing | Compose | Consistency | Design | Max-Res | Gen Speed |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **FLUX 2 Pro** | 10 | 7 | 9 | 8 | 8 | 6 | 8 | 6 |
| **Gemini 3 Pro Image** | 8 | 9 | 10 | 10 | 9 | 7 | 10 | 7 |
| **Seedream v4** | 9 | 9 | 8 | 8 | 8 | 6 | 10 | 7 |
| **Recraft v3** | 5 | 9 | 6 | 7 | 6 | 10 | 7 | 7 |
| **Nano Banana 2** | 7 | 8 | 9 | 9 | 9 | 6 | 7 | 8 |
| **Nano Banana Pro** | 8 | 9 | 10 | 9 | 9 | 7 | 9 | 7 |
| **GPT Image 2** | 8 | 10 | 9 | 8 | 8 | 7 | 6 | 4 |
| **FLUX.1 Dev** | 8 | 6 | 7 | 6 | 6 | 5 | 7 | 7 |
| **FLUX.1 Schnell** | 6 | 4 | — | 5 | 5 | 4 | 6 | 10 |
| **Krea 2 Turbo** | 9 | 5 | — | 6 | 6 | 6 | 7 | 8 |
| **Grok Imagine** | 6 | 5 | — | 5 | 5 | 5 | 6 | 8 |

### 🎙️ Voice

| Model | Expressiveness | Naturalness | Languages | Consistency | Gen Speed |
|---|:-:|:-:|:-:|:-:|:-:|
| **ElevenLabs v3** | 10 | 9 | 10 | 8 | 4 |
| **ElevenLabs Turbo v2.5** | 7 | 8 | 8 | 8 | 10 |
| **ElevenLabs Multilingual v2** | 8 | 9 | 7 | 9 | 6 |

---

## Best at each thing

### Video
- **Realism / graphics** → Veo 3.1
- **Physics** (how things move, fall, collide) → Sora 2 Pro
- **Camera work / directed shots** → Kling o3 Pro
- **Prettiest, most expressive motion** → Hailuo 2.3 Pro
- **Most natural human motion** (weight, hair, cloth) → Seedance 2.0
- **Sound** (3D / spatial audio) → Veo 3.1
- **Audio that matches the video** → Seedance 2.0
- **Same character across shots** → Seedance 2.0 (Kling o3 close)
- **Longest clips** → Sora 2 Pro (~20s)
- **Highest resolution / 4K** → Veo 3.1 & Seedance 2.0
- **Most control** (first + last frame, references) → Seedance 2.0
- **Anime / stylized** → Hailuo 2.3 Pro
- **Cheapest / fastest drafts** → Seedance Mini/Fast, Gemini Omni Flash, Grok
- **Make a photo talk/sing** → OmniHuman
- **Dub / re-voice a video** → Kling LipSync

### Image
- **Overall realism / graphics** → FLUX 2 Pro
- **Most natural, least "AI-plastic"** → Krea 2 Turbo
- **Text inside the image** → GPT Image 2
- **Logos / design / vector art** → Recraft v3
- **Editing** (change one thing, keep the rest) → Gemini 3 Pro Image / Nano Banana Pro
- **Combining multiple photos** → Gemini 3 Pro Image
- **Same character across images** → Nano Banana 2
- **Product / e-commerce shots** → Seedream v4
- **Highest resolution (native 4K)** → Seedream v4 & Gemini 3 Pro Image
- **Fastest / cheapest** → FLUX.1 Schnell

### Voice
- **Most emotion / acting** → ElevenLabs v3
- **Fastest** → ElevenLabs Turbo v2.5
- **Other languages / dubbing** → ElevenLabs Multilingual v2

---

## Notes

- **Gen Speed** = generation / render time (higher = faster), independent of
  output quality. Actual time also swings with the provider's queue/load at that
  moment, so treat it as a relative ranking, not seconds.
- **Video is always far slower than images** regardless of score — a video "8"
  is still minutes; an image "8" is seconds.
- Ratings are one person's calibration for orientation, not gospel — re-score
  against real generations on your own prompts once credits are available.
