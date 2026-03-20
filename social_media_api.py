import os
import base64
import requests
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from auth import verify_token

load_dotenv()

router = APIRouter(prefix="/api/social", tags=["Social Media"])

from openai import OpenAI

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or "placeholder"
openai_client = OpenAI(api_key=OPENAI_API_KEY)
TEXT_MODEL = os.getenv("PROMPT_MODEL", "gpt-4o-mini")

HF_API_TOKEN = os.getenv("HUGGINGFACE_API_TOKEN", "")
HF_BASE_URL = "https://api-inference.huggingface.co/models"

# ── Text Generation ────────────────────────────────────────────────────────────

class SocialContentRequest(BaseModel):
    topic: str
    platforms: list[str]
    tone: str = "Professional"
    brand_name: Optional[str] = ""
    brand_description: Optional[str] = ""
    include_hashtags: bool = True
    include_emoji: bool = True


PLATFORM_INSTRUCTIONS = {
    "instagram": "Write an Instagram caption (max 2200 characters). Make it visually descriptive, engaging, and story-driven. End with a call-to-action.",
    "twitter": "Write a Twitter/X post (strictly under 280 characters). Make it punchy, direct, and shareable.",
    "linkedin": "Write a LinkedIn post (max 1300 characters). Professional, insightful, value-driven. Start with a hook, end with a question or CTA.",
    "facebook": "Write a Facebook post (1-3 paragraphs). Conversational, relatable, community-oriented. Encourage comments and shares.",
    "tiktok": "Write a TikTok caption (max 150 characters). Short, trendy, and fun.",
}


@router.post("/generate")
def generate_social_content(payload: SocialContentRequest, user=Depends(verify_token)):
    if not payload.topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required")

    brand_context = ""
    if payload.brand_name:
        brand_context = f"\nBrand name: {payload.brand_name}"
    if payload.brand_description:
        brand_context += f"\nBrand description: {payload.brand_description}"

    results: dict[str, str] = {}
    for platform in payload.platforms:
        pk = platform.lower()
        if pk not in PLATFORM_INSTRUCTIONS:
            continue
        prompt = f"""{PLATFORM_INSTRUCTIONS[pk]}

Topic: {payload.topic}
Tone: {payload.tone}{brand_context}
{"Include 5-10 relevant hashtags at the end." if payload.include_hashtags else "No hashtags."}
{"Use relevant emojis." if payload.include_emoji else "No emojis."}

Return ONLY the post content. No explanations, labels, or quotation marks."""
        try:
            resp = openai_client.responses.create(model=TEXT_MODEL, input=prompt)
            results[pk] = resp.output_text.strip()
        except Exception as e:
            results[pk] = f"[Error: {str(e)}]"

    return {"platforms": results}


# ── Image Generation — Hugging Face Inference API ─────────────────────────────
#
#  Models supported:
#   • FLUX Schnell   — black-forest-labs/FLUX.1-schnell  (fastest, highest quality)
#   • FLUX Dev       — black-forest-labs/FLUX.1-dev      (best quality, slower)
#   • SDXL           — stabilityai/stable-diffusion-xl-base-1.0
#   • SD 1.5         — runwayml/stable-diffusion-v1-5
#   • Realistic Vision — SG161222/Realistic_Vision_V6.0_B1_noVAE
#   • DreamShaper    — Lykon/dreamshaper-8
#   • ControlNet     — lllyasviel/control_v11p_sd15_openpose (structure-guided)
#
#  Requires: HUGGINGFACE_API_TOKEN env var
# ─────────────────────────────────────────────────────────────────────────────

HF_MODELS: dict[str, dict] = {
    "flux-schnell": {
        "id": "black-forest-labs/FLUX.1-schnell",
        "label": "FLUX Schnell",
        "params": {
            "num_inference_steps": 4,
            "guidance_scale": 0.0,
        },
    },
    "flux-dev": {
        "id": "black-forest-labs/FLUX.1-dev",
        "label": "FLUX Dev",
        "params": {
            "num_inference_steps": 28,
            "guidance_scale": 3.5,
        },
    },
    "sdxl": {
        "id": "stabilityai/stable-diffusion-xl-base-1.0",
        "label": "Stable Diffusion XL",
        "params": {
            "num_inference_steps": 40,
            "guidance_scale": 7.5,
        },
    },
    "sd15": {
        "id": "runwayml/stable-diffusion-v1-5",
        "label": "SD 1.5",
        "params": {
            "num_inference_steps": 30,
            "guidance_scale": 7.5,
        },
    },
    "realistic-vision": {
        "id": "SG161222/Realistic_Vision_V6.0_B1_noVAE",
        "label": "Realistic Vision",
        "params": {
            "num_inference_steps": 35,
            "guidance_scale": 7.0,
            "negative_prompt": "cartoon, anime, illustration, painting, drawing, low quality, blurry",
        },
    },
    "dreamshaper": {
        "id": "Lykon/dreamshaper-8",
        "label": "DreamShaper",
        "params": {
            "num_inference_steps": 35,
            "guidance_scale": 7.0,
            "negative_prompt": "bad quality, blurry, low resolution",
        },
    },
    "controlnet": {
        "id": "lllyasviel/control_v11p_sd15_openpose",
        "label": "ControlNet",
        "params": {
            "num_inference_steps": 30,
            "guidance_scale": 7.5,
        },
    },
}

# Map aspect ratios to pixel dimensions
DIMENSIONS: dict[str, dict] = {
    "1:1":    {"width": 1024, "height": 1024},
    "9:16":   {"width": 768,  "height": 1344},
    "16:9":   {"width": 1344, "height": 768},
    "4:5":    {"width": 896,  "height": 1120},
}

# SD 1.5-based models use lower resolution
SD15_DIMENSIONS: dict[str, dict] = {
    "1:1":    {"width": 512,  "height": 512},
    "9:16":   {"width": 512,  "height": 768},
    "16:9":   {"width": 768,  "height": 512},
    "4:5":    {"width": 512,  "height": 640},
}

SD15_MODELS = {"sd15", "realistic-vision", "dreamshaper", "controlnet"}

STYLE_PROMPTS = {
    "photorealistic": "professional photography, photorealistic, DSLR, sharp focus, perfect lighting, 8K",
    "illustration": "digital illustration, vibrant colors, artistic, modern vector art, clean lines",
    "minimalist": "minimalist design, clean composition, white space, simple shapes, modern aesthetic",
    "corporate": "professional corporate photography, business setting, polished, executive look",
    "artistic": "artistic painterly style, expressive, cinematic, dramatic lighting, fine art",
    "3d-render": "3D CGI render, modern, glossy, studio lighting, product visualization",
    "flat-design": "flat design illustration, geometric shapes, bold colors, 2D modern icon style",
    "vintage": "vintage aesthetic, retro style, film grain, muted warm tones, nostalgic",
}


class SocialImageRequest(BaseModel):
    topic: str
    model: str = "flux-schnell"
    style: str = "photorealistic"
    aspect_ratio: str = "1:1"
    custom_prompt: Optional[str] = ""
    platform: Optional[str] = "instagram"


@router.post("/generate-image")
def generate_social_image(payload: SocialImageRequest, user=Depends(verify_token)):
    if not HF_API_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="Image generation requires HUGGINGFACE_API_TOKEN. Add it to your environment variables.",
        )

    model_cfg = HF_MODELS.get(payload.model, HF_MODELS["flux-schnell"])
    model_id = model_cfg["id"]
    model_params = dict(model_cfg["params"])

    # Build prompt
    style_desc = STYLE_PROMPTS.get(payload.style, "professional, high quality")
    base_prompt = payload.custom_prompt.strip() if payload.custom_prompt else payload.topic
    full_prompt = f"{base_prompt}. {style_desc}. Social media marketing image. No text overlays."

    # Set dimensions based on model type
    dim_map = SD15_DIMENSIONS if payload.model in SD15_MODELS else DIMENSIONS
    dims = dim_map.get(payload.aspect_ratio, dim_map["1:1"])
    model_params.update(dims)

    payload_body: dict = {
        "inputs": full_prompt,
        "parameters": model_params,
    }

    headers = {
        "Authorization": f"Bearer {HF_API_TOKEN}",
        "Content-Type": "application/json",
        "X-Wait-For-Model": "true",   # don't get 503, wait for model to load
        "X-Use-Cache": "false",       # always generate fresh
    }

    try:
        response = requests.post(
            f"{HF_BASE_URL}/{model_id}",
            headers=headers,
            json=payload_body,
            timeout=120,
        )
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Image generation timed out. The model may be loading — please try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")

    if not response.ok:
        try:
            err_detail = response.json()
        except Exception:
            err_detail = response.text[:300]
        raise HTTPException(status_code=response.status_code, detail=f"HF API error: {err_detail}")

    # Response is raw image bytes
    image_b64 = base64.b64encode(response.content).decode("utf-8")
    content_type = response.headers.get("content-type", "image/jpeg")

    return {
        "image_base64": image_b64,
        "content_type": content_type,
        "model_used": model_id,
        "model_label": model_cfg["label"],
        "prompt_used": full_prompt,
    }
