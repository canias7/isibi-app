#!/usr/bin/env python3
"""Pull fal's published OpenAPI schema for every endpoint the worker routes to
and print the constraints it documents, so our tables can be checked against
the source rather than against each other."""
import json, subprocess, sys, re

BASE = "https://fal.ai/api/openapi/queue/openapi.json?endpoint_id="

VIDEO = [
    "fal-ai/veo3.1", "fal-ai/veo3.1/image-to-video", "fal-ai/veo3.1/extend-video",
    "fal-ai/veo3.1/reference-to-video", "fal-ai/veo3.1/first-last-frame-to-video",
    "fal-ai/veo3.1/fast", "fal-ai/veo3.1/fast/extend-video", "fal-ai/veo3.1/lite",
    "bytedance/seedance-2.0/text-to-video", "bytedance/seedance-2.0/reference-to-video",
    "bytedance/seedance-2.0/fast/text-to-video", "bytedance/seedance-2.0/mini/text-to-video",
    "fal-ai/kling-video/o3/pro/text-to-video", "fal-ai/kling-video/o3/pro/video-to-video/edit",
    "fal-ai/kling-video/o3/standard/text-to-video",
    "fal-ai/kling-video/v3/pro/text-to-video", "fal-ai/kling-video/v3/standard/text-to-video",
    "fal-ai/kling-video/lipsync/audio-to-video",
    "google/gemini-omni-flash", "google/gemini-omni-flash/edit",
    "google/gemini-omni-flash/image-to-video", "google/gemini-omni-flash/reference-to-video",
]
IMAGE = ["fal-ai/nano-banana-pro", "fal-ai/nano-banana-pro/edit",
         "openai/gpt-image-2", "openai/gpt-image-2/edit"]
AUDIO = ["fal-ai/elevenlabs/tts/eleven-v3", "fal-ai/elevenlabs/tts/turbo-v2.5",
         "fal-ai/elevenlabs/tts/multilingual-v2"]

KEYS = ("duration", "duration_seconds", "resolution", "aspect_ratio", "num_images",
        "image_size", "quality", "video_url", "image_urls", "audio_url", "text")
LIMIT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(seconds?|sec\b|s\b|MB|mb|fps|minutes?)", re.I)


def fetch(eid):
    try:
        out = subprocess.run(["curl", "-sS", "--max-time", "25", BASE + eid],
                             capture_output=True, timeout=40).stdout
        return json.loads(out)
    except Exception:
        return None


def report(eid):
    d = fetch(eid)
    if not d or "components" not in d:
        print(f"  {eid:<52} — no schema")
        return
    sch = d["components"].get("schemas", {})
    inp = next((v for k, v in sch.items() if k.endswith("Input")), None)
    if not inp:
        print(f"  {eid:<52} — no Input schema")
        return
    bits = []
    for k, v in (inp.get("properties") or {}).items():
        if k not in KEYS:
            continue
        if "enum" in v:
            bits.append(f"{k}={v['enum']}")
        elif "minimum" in v or "maximum" in v:
            bits.append(f"{k}={v.get('minimum','?')}..{v.get('maximum','?')}")
        elif v.get("description"):
            found = LIMIT_RE.findall(v["description"])
            if found:
                bits.append(f"{k}~{','.join(a + b for a, b in found[:3])}")
    print(f"  {eid:<52} {' | '.join(bits) if bits else '(no constrained fields)'}")


for title, group in (("VIDEO", VIDEO), ("IMAGE", IMAGE), ("AUDIO", AUDIO)):
    print(f"\n=== {title} ===")
    for eid in group:
        report(eid)
