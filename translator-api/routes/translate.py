# Translation logic using OpenAI GPT-4
import json
import re
from typing import Dict, Optional
import openai

# Command templates
COMMAND_TEMPLATES = {
    'navigate': {
        'action': 'navigate',
        'url': None
    },
    'search': {
        'action': 'search',
        'query': None
    },
    'click': {
        'action': 'click',
        'x': None,
        'y': None,
        'selector': None
    },
    'type': {
        'action': 'type',
        'text': None,
        'selector': None
    },
    'scroll': {
        'action': 'scroll',
        'direction': 'down',
        'amount': 100
    }
}

def translate_prompt(prompt: str, api_key: str) -> Optional[Dict]:
    """
    Translate natural language prompt to browser automation command
    """
    if not api_key:
        return {'error': 'OpenAI API key not configured'}
    
    # Set OpenAI API key
    openai.api_key = api_key
    
    try:
        # Use GPT-4 to translate the prompt
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": """You are a browser automation assistant. Convert natural language commands into structured JSON commands.
                    
Available actions:
1. navigate: Go to a specific URL
   Example: {"action": "navigate", "url": "https://example.com"}
   
2. search: Search for something on Google
   Example: {"action": "search", "query": "artificial intelligence"}
   
3. click: Click on an element (provide selector or coordinates)
   Example: {"action": "click", "selector": "#submit-button"}
   
4. type: Type text into an input field
   Example: {"action": "type", "text": "Hello world", "selector": "input[name='search']"}
   
5. scroll: Scroll the page
   Example: {"action": "scroll", "direction": "down", "amount": 300}

Return ONLY the JSON command, no explanation."""
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3,
            max_tokens=200
        )
        
        # Extract JSON from response
        command_text = response.choices[0].message.content.strip()
        
        # Try to parse JSON
        try:
            command = json.loads(command_text)
            return validate_command(command)
        except json.JSONDecodeError:
            # Try to extract JSON from text
            json_match = re.search(r'\{.*\}', command_text, re.DOTALL)
            if json_match:
                command = json.loads(json_match.group())
                return validate_command(command)
            else:
                # Fallback to simple parsing
                return parse_simple_command(prompt)
                
    except Exception as e:
        print(f"OpenAI API error: {str(e)}")
        # Fallback to simple parsing
        return parse_simple_command(prompt)

def validate_command(command: Dict) -> Dict:
    """
    Validate and sanitize command structure
    """
    if 'action' not in command:
        return {'error': 'Invalid command: missing action'}
    
    action = command['action']
    
    # Validate based on action type
    if action == 'navigate':
        if 'url' not in command:
            return {'error': 'Navigate command requires URL'}
        # Ensure URL has protocol
        if not command['url'].startswith(('http://', 'https://')):
            command['url'] = 'https://' + command['url']
            
    elif action == 'search':
        if 'query' not in command:
            return {'error': 'Search command requires query'}
            
    elif action == 'click':
        if 'selector' not in command and ('x' not in command or 'y' not in command):
            return {'error': 'Click command requires selector or coordinates'}
            
    elif action == 'type':
        if 'text' not in command:
            return {'error': 'Type command requires text'}
            
    elif action == 'scroll':
        # Set defaults
        command.setdefault('direction', 'down')
        command.setdefault('amount', 100)
    
    return command

def parse_simple_command(prompt: str) -> Dict:
    """
    Simple fallback parser for common commands
    """
    prompt_lower = prompt.lower()
    
    # Search patterns
    search_patterns = [
        r'search\s+(?:for\s+)?(.+)',
        r'google\s+(.+)',
        r'find\s+(?:information\s+)?(?:about\s+)?(.+)',
        r'look\s+up\s+(.+)',
        r'what\s+is\s+(.+)'
    ]
    
    for pattern in search_patterns:
        match = re.search(pattern, prompt_lower)
        if match:
            return {
                'action': 'search',
                'query': match.group(1).strip()
            }
    
    # Navigate patterns
    navigate_patterns = [
        r'(?:go\s+to|open|visit|navigate\s+to)\s+(.+)',
        r'(.+\.(?:com|org|net|edu|gov|io|co|uk)(?:/\S*)?)'
    ]
    
    for pattern in navigate_patterns:
        match = re.search(pattern, prompt_lower)
        if match:
            url = match.group(1).strip()
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url
            return {
                'action': 'navigate',
                'url': url
            }
    
    # Type patterns
    type_patterns = [
        r'type\s+"([^"]+)"',
        r'type\s+\'([^\']+)\'',
        r'enter\s+"([^"]+)"',
        r'write\s+"([^"]+)"'
    ]
    
    for pattern in type_patterns:
        match = re.search(pattern, prompt_lower)
        if match:
            return {
                'action': 'type',
                'text': match.group(1)
            }
    
    # Scroll patterns
    if any(word in prompt_lower for word in ['scroll', 'page down', 'page up']):
        direction = 'up' if 'up' in prompt_lower else 'down'
        amount_match = re.search(r'(\d+)', prompt)
        amount = int(amount_match.group(1)) if amount_match else 300
        
        return {
            'action': 'scroll',
            'direction': direction,
            'amount': amount
        }
    
    # Click patterns
    click_patterns = [
        r'click\s+(?:on\s+)?(?:the\s+)?(.+)',
        r'press\s+(?:the\s+)?(.+)\s+button'
    ]
    
    for pattern in click_patterns:
        match = re.search(pattern, prompt_lower)
        if match:
            selector = match.group(1).strip()
            return {
                'action': 'click',
                'selector': selector
            }
    
    # Default to search if no pattern matches
    return {
        'action': 'search',
        'query': prompt
    }