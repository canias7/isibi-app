# ADD THIS TO portal.py

# At the top, add these imports (if not already there):
from bs4 import BeautifulSoup
import requests
from anthropic import Anthropic

# Add this new request model with your other BaseModel classes:
class GeneratePromptFromURLRequest(BaseModel):
    url: str

# Add this endpoint with your other @router endpoints:
@router.post("/api/agents/generate-prompt-from-url")
def generate_prompt_from_url(payload: GeneratePromptFromURLRequest, user=Depends(verify_token)):
    """
    Scrape a website and generate a system prompt using Claude
    """
    url = payload.url
    
    if not url:
        raise HTTPException(status_code=400, detail="URL required")
    
    # Add https:// if missing
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    try:
        # 1. Fetch the website with a user agent to avoid blocking
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, timeout=15, headers=headers)
        response.raise_for_status()
        
        # 2. Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script, style, and nav elements
        for element in soup(["script", "style", "nav", "footer", "header"]):
            element.decompose()
        
        # Get text content
        text = soup.get_text()
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        # Get meta description if available
        meta_desc = ""
        meta_tag = soup.find("meta", attrs={"name": "description"})
        if meta_tag and meta_tag.get("content"):
            meta_desc = meta_tag.get("content")
        
        # Get title
        title = soup.find("title")
        page_title = title.string if title else ""
        
        # Limit to first 8000 characters to avoid token limits
        website_content = text[:8000]
        
        # 3. Use Claude to generate system prompt
        anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
        
        if not anthropic_api_key:
            raise HTTPException(status_code=500, detail="Anthropic API key not configured")
        
        client = Anthropic(api_key=anthropic_api_key)
        
        prompt = f"""Based on this website, create a concise AI phone agent system prompt (max 300 words).

Website URL: {url}
Page Title: {page_title}
Meta Description: {meta_desc}

Website Content:
{website_content}

Create a system prompt for an AI phone receptionist that:
1. Introduces the business by name
2. Describes what the business does (1-2 sentences)
3. Lists key services/products (bullet points if many)
4. Includes business hours if mentioned
5. Includes location/address if mentioned
6. Explains how the AI can help callers (take orders, schedule appointments, answer questions, etc.)
7. Sets the right tone (professional for law firm, friendly for restaurant, etc.)
8. Is under 300 words
9. Uses "You are..." format

DO NOT include:
- Generic AI disclaimers
- Long introductions
- Repetitive information
- Marketing fluff

Make it practical and ready to use."""

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        generated_prompt = message.content[0].text.strip()
        
        return {
            "success": True,
            "prompt": generated_prompt,
            "url": url,
            "page_title": page_title,
            "meta_description": meta_desc,
            "preview": website_content[:300]
        }
        
    except requests.Timeout:
        raise HTTPException(status_code=408, detail="Website took too long to respond")
    except requests.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch website: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating prompt: {str(e)}")
