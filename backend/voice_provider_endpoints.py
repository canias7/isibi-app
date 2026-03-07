

# ========== Voice Provider Endpoints ==========

from elevenlabs_integration import get_all_voice_options, get_available_voices, get_user_subscription

@router.get("/voices/providers")
def get_voice_providers(user=Depends(verify_token)):
    """
    Get all available voice providers and their voices
    
    Returns:
        {
            "providers": [
                {
                    "id": "openai",
                    "name": "OpenAI",
                    "voices": [...]
                },
                {
                    "id": "elevenlabs",
                    "name": "ElevenLabs",
                    "voices": [...],
                    "enabled": true/false
                }
            ]
        }
    """
    import os
    
    # Check if ElevenLabs is configured
    elevenlabs_enabled = bool(os.getenv("ELEVENLABS_API_KEY"))
    
    # Get all voices
    all_voices = get_all_voice_options()
    
    providers = [
        {
            "id": "openai",
            "name": "OpenAI",
            "description": "High-quality AI voices with natural speech",
            "enabled": True,
            "voices": all_voices["openai"]
        },
        {
            "id": "elevenlabs",
            "name": "ElevenLabs",
            "description": "Ultra-realistic AI voices with emotion",
            "enabled": elevenlabs_enabled,
            "voices": all_voices["elevenlabs"] if elevenlabs_enabled else []
        }
    ]
    
    return {"providers": providers}


@router.get("/voices/elevenlabs")
def get_elevenlabs_voices(user=Depends(verify_token)):
    """
    Get available ElevenLabs voices
    
    Returns list of ElevenLabs voices with IDs, names, and previews
    """
    import os
    
    if not os.getenv("ELEVENLABS_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="ElevenLabs not configured. Please add ELEVENLABS_API_KEY to environment variables."
        )
    
    voices = get_available_voices()
    
    return {
        "voices": voices,
        "count": len(voices)
    }


@router.get("/voices/elevenlabs/subscription")
def get_elevenlabs_subscription_info(user=Depends(verify_token)):
    """
    Get ElevenLabs subscription information
    
    Returns character quota and usage
    """
    import os
    
    if not os.getenv("ELEVENLABS_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="ElevenLabs not configured"
        )
    
    subscription = get_user_subscription()
    
    if not subscription:
        raise HTTPException(
            status_code=500,
            detail="Failed to get subscription info"
        )
    
    return subscription


@router.get("/voices/test/{provider}/{voice_id}")
def test_voice(
    provider: str,
    voice_id: str,
    user=Depends(verify_token),
    text: str = "Hello! This is a test of this voice. How do you like it?"
):
    """
    Test a voice by generating sample audio
    
    Args:
        provider: 'openai' or 'elevenlabs'
        voice_id: Voice ID to test
        text: Optional custom text to speak
    
    Returns:
        Audio file download
    """
    from fastapi.responses import Response
    
    if provider == "elevenlabs":
        import os
        if not os.getenv("ELEVENLABS_API_KEY"):
            raise HTTPException(status_code=503, detail="ElevenLabs not configured")
        
        from elevenlabs_integration import text_to_speech
        
        audio = text_to_speech(text, voice_id)
        
        if not audio:
            raise HTTPException(status_code=500, detail="Failed to generate audio")
        
        return Response(
            content=audio,
            media_type="audio/mpeg",
            headers={"Content-Disposition": f"attachment; filename=voice_test_{voice_id}.mp3"}
        )
    
    elif provider == "openai":
        # For OpenAI, we can't easily generate a test without setting up the full Realtime API
        # So we'll just return a success message
        return {
            "success": True,
            "message": f"Voice '{voice_id}' is available. Test it in a real call to hear it.",
            "voice_id": voice_id
        }
    
    else:
        raise HTTPException(status_code=400, detail="Invalid provider. Use 'openai' or 'elevenlabs'")
