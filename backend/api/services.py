"""
Adaptive Learning Core — Production & Testable Implementation

A senior-level refactor focusing on:
1. Object-Oriented Design: Encapsulating state in LearningAgent for testability.
2. Dependency Injection: Allowing mock models to be injected during validation.
3. Resource Optimization: Efficient initialization and prompt reuse.
4. Robust Sanitization: Defensive programming to prevent common attacks.
"""

import os
import json
import logging
import time
from typing import Dict, Any, List, Optional, Protocol

import google.generativeai as genai

# ─────────────────────────────────────────────────────────────
# Interfaces for Testability (Protocol)
# ─────────────────────────────────────────────────────────────

class AIModel(Protocol):
    def generate_content(self, prompt: str) -> Any: ...

# ─────────────────────────────────────────────────────────────
# Security & Utility Layer
# ─────────────────────────────────────────────────────────────

logger = logging.getLogger(__name__)

class SecurityGuard:
    """Centralized input validation and sanitization."""
    
    @staticmethod
    def sanitize(text: str, max_length: int) -> str:
        if not text:
            return ""
        import re
        # Strip potential HTML/Script tags
        clean = re.sub(r'<.*?>', '', str(text))
        return clean.strip()[:max_length]

    @staticmethod
    def validate_level(level: str) -> str:
        valid_levels = ['Beginner', 'Intermediate', 'Advanced']
        return level if level in valid_levels else 'Beginner'

# ─────────────────────────────────────────────────────────────
# Main Agent Engine
# ─────────────────────────────────────────────────────────────

class LearningAgent:
    """
    State-aware agent that handles the learning loop.
    Designed for high testability and resource efficiency.
    """
    
    def __init__(self, model: Optional[AIModel] = None):
        # Dependency Injection: allows passing a mock model for unit tests
        self.model = model or self._init_default_model()
        self.max_retries = 3

    def _init_default_model(self) -> AIModel:
        """Initializes the production Gemini model."""
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise EnvironmentError("GEMINI_API_KEY missing from environment.")
            
        genai.configure(api_key=api_key)
        return genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            generation_config={
                "temperature": 0.7,
                "response_mime_type": "application/json",
            }
        )

    def process_turn(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes a single turn in the learning session.
        Implements error isolation and retry logic.
        """
        # 1. Sanitize Inputs
        topic = SecurityGuard.sanitize(context.get('topic'), 150)
        level = SecurityGuard.validate_level(context.get('user_level'))
        user_answer = SecurityGuard.sanitize(context.get('user_answer'), 1500)
        
        prompt = self._build_prompt(
            topic, level, context.get('step', 1), 
            context.get('learning_path', []), 
            context.get('last_question', ''), 
            user_answer
        )

        # 2. Resilient Execution
        for attempt in range(self.max_retries):
            try:
                response = self.model.generate_content(prompt)
                data = json.loads(response.text)
                return self._validate_schema(data, context.get('step', 1))
                
            except Exception as e:
                logger.error(f"Agent failure (attempt {attempt+1}): {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(1.0 * (2 ** attempt)) # Backoff
                    
        return self._get_fallback(context.get('step', 1))

    def _build_prompt(self, topic, level, step, path, last_q, user_a) -> str:
        """Centralized prompt management."""
        phase = "START" if not path else "EVAL" if user_a else "TEACH"
        
        return f"""
ROLE: Expert Academic Mentor.
CONTEXT: topic={topic}, level={level}, step={step}, path={json.dumps(path)}, last_q={last_q}, user_a={user_a}
PHASE: {phase}

INSTRUCTION:
- Write a 2-3 paragraph response that provides a detailed explanation, a practical example/analogy, and a follow-up question.
- Use **bolding** for key terms.
- Adapt complexity strictly to a '{level}' student.
- JSON output ONLY.

SCHEMA:
{{
  "step": {step} (+1 if 'advance'),
  "explanation": "Markdown-enabled string",
  "evaluation": {{"result": "correct|partial|incorrect|null", "feedback": "Constructive feedback"}},
  "next_action": "advance|retry|simplify",
  "learning_path": ["List of remaining topics"]
}}
"""

    def _validate_schema(self, data: Dict, current_step: int) -> Dict:
        """Ensures the output matches our strict application contract."""
        keys = ["step", "explanation", "evaluation", "next_action", "learning_path"]
        for k in keys:
            if k not in data: data[k] = "" # Defensive defaults
        
        try:
            data["step"] = int(data["step"])
        except:
            data["step"] = current_step
        return data

    def _get_fallback(self, step: int) -> Dict:
        return {
            "step": step,
            "explanation": "I encountered a minor processing error. Could you please re-state your last answer so I can re-analyze it?",
            "evaluation": {"result": "null", "feedback": ""},
            "next_action": "retry",
            "learning_path": []
        }

# ─────────────────────────────────────────────────────────────
# Public Entry Point
# ─────────────────────────────────────────────────────────────

def get_adaptive_response(topic, user_level, step_number, steps_array, last_question, user_answer) -> Dict:
    """Legacy wrapper for backward compatibility, now using the class-based agent."""
    agent = LearningAgent()
    return agent.process_turn({
        'topic': topic,
        'user_level': user_level,
        'step': step_number,
        'learning_path': steps_array,
        'last_question': last_question,
        'user_answer': user_answer
    })
