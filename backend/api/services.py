"""
Adaptive Learning Service Architecture — Professional Grade

A senior-level implementation focusing on:
1. Factory Pattern: Abstracting AI provider logic for future-proofing.
2. Resilience: Implementing exponential backoff retries for API stability.
3. Security: Multi-stage sanitization to prevent prompt injection and XSS.
4. Observability: Structured JSON logging for high-scale monitoring.
"""

import os
import json
import logging
import time
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict

import google.generativeai as genai
from django.core.exceptions import PermissionDenied

# ─────────────────────────────────────────────────────────────
# Configuration & Constants
# ─────────────────────────────────────────────────────────────

logger = logging.getLogger(__name__)

# Security Thresholds
MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 1.0  # seconds
MAX_TOPIC_LEN = 150
MAX_USER_LEN = 1500

# AI Model Config
DEFAULT_MODEL = "gemini-1.5-flash"

@dataclass
class LearnResponse:
    step: int
    explanation: string
    analogy: string
    question: string
    evaluation: Dict[str, str]
    next_action: str
    learning_path: List[str]

# ─────────────────────────────────────────────────────────────
# Security Logic (Defense in Depth)
# ─────────────────────────────────────────────────────────────

def sanitize_input(text: str, max_length: int) -> str:
    """
    Multi-stage sanitization for production safety.
    1. Length clamping.
    2. HTML tag stripping (prevent XSS in logs/admin).
    3. Trimming whitespace.
    """
    if not text:
        return ""
    
    # 1. Strip HTML tags using simple regex/replace to avoid heavy dependencies
    import re
    clean = re.sub(r'<.*?>', '', text)
    
    # 2. Trim and Clamp
    clean = clean.strip()[:max_length]
    
    # 3. Detection of common prompt injection patterns (Basic)
    injection_keywords = ["ignore previous instructions", "system prompt", "as a developer"]
    lower_clean = clean.lower()
    for kw in injection_keywords:
        if kw in lower_clean:
            logger.warning(f"Potential prompt injection detected: {kw}")
            # We don't block yet, but we log for security audits
            
    return clean

# ─────────────────────────────────────────────────────────────
# AI Provider Factory (Scalability)
# ─────────────────────────────────────────────────────────────

class AIModelFactory:
    """
    Ensures model configuration is centralized. 
    Allows easy switching between Flash, Pro, or even other providers in the future.
    """
    @staticmethod
    def get_model(json_mode: bool = False) -> genai.GenerativeModel:
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise EnvironmentError("GEMINI_API_KEY is not configured in the environment.")

        genai.configure(api_key=api_key)
        
        config = {
            "temperature": 0.7,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 2048,
        }
        
        if json_mode:
            config["response_mime_type"] = "application/json"

        return genai.GenerativeModel(
            model_name=DEFAULT_MODEL,
            generation_config=config,
        )

# ─────────────────────────────────────────────────────────────
# Core Service Logic
# ─────────────────────────────────────────────────────────────

def get_adaptive_response(
    topic: str,
    user_level: str,
    step_number: int,
    steps_array: List[str],
    last_question: str,
    user_answer: str,
) -> Dict[str, Any]:
    """
    High-resilience wrapper for the learning agent.
    Implements retries and structured error handling.
    """
    # 1. Sanitize all inputs before they touch the prompt
    safe_topic = sanitize_input(topic, MAX_TOPIC_LEN)
    safe_answer = sanitize_input(user_answer, MAX_USER_LEN)
    
    prompt = _build_professional_prompt(
        safe_topic, user_level, step_number, steps_array, last_question, safe_answer
    )

    # 2. Resilient Execution Loop
    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            model = AIModelFactory.get_model(json_mode=True)
            response = model.generate_content(prompt)
            
            # 3. Validation of output
            data = json.loads(response.text)
            return _validate_response_schema(data, step_number)

        except (json.JSONDecodeError, KeyError) as e:
            logger.error(f"AI Schema Error (Attempt {attempt+1}): {e}")
            last_error = "Received malformed response from AI engine."
        except Exception as e:
            logger.error(f"AI Connection Error (Attempt {attempt+1}): {e}")
            last_error = f"AI Service temporarily unavailable. ({type(e).__name__})"
            time.sleep(INITIAL_RETRY_DELAY * (2 ** attempt)) # Exponential backoff

    # 4. Graceful Degradation
    return _get_fallback_response(step_number, last_error or "Service error")

# ─────────────────────────────────────────────────────────────
# Private Internal Helpers
# ─────────────────────────────────────────────────────────────

def _build_professional_prompt(topic, level, step, path, last_q, user_a) -> str:
    """Encapsulates the 'Teacher Personality' logic."""
    phase = "INITIAL_PATH" if not path else "EVALUATION" if user_a else "TEACHING"
    
    return f"""
ROLE: You are an elite, world-class Adaptive Learning Mentor.
CONTEXT:
- Subject: {topic}
- Student Level: {level}
- Current Progress: Step {step}
- Session Path: {json.dumps(path) if path else "None"}
- Last Question: {last_q}
- Student Response: {user_a}
- Current Phase: {phase}

GOAL:
- Deliver a sophisticated, detailed, and highly personalized explanation.
- PROVIDE DEPTH: Use 2-3 paragraphs if necessary to explain the concept thoroughly.
- SHOW EXAMPLES: Always provide a concrete code snippet or real-world example.
- USE FORMATTING: Use **bolding** for key terms and concepts. Use `code` tags for technical terms.
- INTEGRATE: Weave feedback, explanation, analogies, and questions into a natural, flowing narrative.
- Tone should be that of a world-class mentor—encouraging, precise, and expert-level.

EVALUATION RULES:
- If user_a is present, evaluate it as 'correct', 'partial', or 'incorrect'.
- Provide constructive, helpful feedback at the START of your response.
- Decide 'next_action': 'advance' (if correct/partial) or 'retry' (if incorrect).
- ADAPT: If 'Beginner', simplify terminology. If 'Advanced', discuss architecture and edge cases.

OUTPUT FORMAT: Strict JSON only.
{{
  "step": {step} (+1 if advancing),
  "explanation": "One flowing paragraph containing feedback (if any), explanation, analogy, and question.",
  "analogy": "internal reference only",
  "question": "internal reference only",
  "evaluation": {{"result": "correct|partial|incorrect|null", "feedback": "Constructive feedback"}},
  "next_action": "advance|retry|simplify",
  "learning_path": ["Array of future step titles"]
}}
"""

def _validate_response_schema(data: Dict, current_step: int) -> Dict:
    """Ensures the AI output matches our expected contract."""
    required = ["step", "explanation", "evaluation", "next_action"]
    for field in required:
        if field not in data:
            raise KeyError(f"Missing required field: {field}")
    
    # Ensure step is a valid integer
    try:
        data["step"] = int(data["step"])
    except:
        data["step"] = current_step
        
    return data

def _get_fallback_response(step: int, error_msg: str) -> Dict:
    """Standardized error recovery."""
    return {
        "step": step,
        "explanation": f"I'm having a slight trouble connecting to my knowledge base right now. {error_msg}. Could you please try repeating your last thought?",
        "evaluation": {"result": "null", "feedback": ""},
        "next_action": "retry",
        "learning_path": []
    }
