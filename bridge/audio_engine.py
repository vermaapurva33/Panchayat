"""
Panchayat Bridge — ElevenLabs Audio Engine
============================================
Handles Text-to-Speech (TTS) generation for the AI candidates using ElevenLabs.
"""

import os
import base64
import requests

# Voice mapping using user-verified working keys
VOICE_MAP = {
    "dharma_rakshak": "ArrvWhR1f2Ax4imidQSP",  # male_voice_1 -> Pt. Vedprakash
    "vikas_purush": "RnauXKDOkyVg9FjwISwR",    # male_voice_2 -> Arjun Mehra
    "jan_neta": "1Z7Y8o9cvUeWq8oLKgMY",        # female_voice_1 -> Comrade Meera
    "mukti_devi": "K2Byg54sHB1oHegvENtI",      # female_voice_2 -> Nandini
}

def generate_speech_base64(candidate_id: str, text: str) -> str:
    """
    Calls ElevenLabs API to generate speech for the given candidate and text.
    Returns the MP3 audio file encoded as a Base64 string.
    """
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        print(f"⚠️  ELEVENLABS_API_KEY not found in .env. Skipping audio for {candidate_id}.")
        return ""

    voice_id = VOICE_MAP.get(candidate_id)
    if not voice_id:
        print(f"⚠️  No voice mapping found for candidate {candidate_id}")
        return ""

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128"
    
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json"
    }
    
    data = {
        "text": text,
        "model_id": "eleven_multilingual_v2",  # Multilingual handles Indian accents/words better
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.8
        }
    }

    try:
        # We use a 15-second timeout to ensure the SSE stream doesn't hang forever
        response = requests.post(url, json=data, headers=headers, timeout=15)
        response.raise_for_status()
        
        # Read raw MP3 bytes
        audio_bytes = response.content
        
        # Encode to Base64 so we can stream it seamlessly in the JSON SSE payload
        return base64.b64encode(audio_bytes).decode("utf-8")
        
    except Exception as e:
        print(f"❌ ElevenLabs TTS Error for {candidate_id}: {e}")
        return ""
