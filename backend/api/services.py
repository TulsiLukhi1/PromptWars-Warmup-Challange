import os
import json
import logging
import google.generativeai as genai

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_model(response_mime_type: str | None = None):
    """
    Configures the Gemini SDK with the API key from the environment and
    returns a ready-to-use GenerativeModel instance.

    Raises:
        EnvironmentError: If GEMINI_API_KEY is missing or invalid.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "dummy_key_for_now":
        raise EnvironmentError(
            "A valid GEMINI_API_KEY environment variable is required."
        )

    genai.configure(api_key=api_key)

    generation_config = {}
    if response_mime_type:
        generation_config["response_mime_type"] = response_mime_type

    return genai.GenerativeModel("gemini-flash-latest", generation_config=generation_config)


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

def get_ai_response(prompt: str) -> str:
    """
    Sends a plain text prompt to Gemini and returns the text response.

    Args:
        prompt: The user's question or instruction.

    Returns:
        The model's text response, or an error message string.
    """
    try:
        model = _get_model()
        response = model.generate_content(prompt)
        return response.text
    except EnvironmentError as exc:
        logger.error("API key not configured: %s", exc)
        return str(exc)
    except Exception as exc:
        logger.exception("Unexpected error in get_ai_response")
        return f"Error communicating with AI: {exc}"


def adaptive_learning_agent(
    topic: str,
    user_level: str,
    step_number: int,
    steps_array: list,
    last_question: str,
    user_answer: str,
) -> dict:
    """
    Drives a step-by-step adaptive learning session using Gemini.

    The model returns strict JSON conforming to the LearnResponse schema.
    If parsing fails, a safe fallback dict is returned so the frontend
    never receives an unhandled exception.

    Args:
        topic:         Subject the user wants to learn.
        user_level:    'Beginner', 'Intermediate', or 'Advanced'.
        step_number:   Current step in the session (1-indexed).
        steps_array:   Previously generated learning path steps.
        last_question: The question asked in the previous turn.
        user_answer:   The user's answer to that question (empty on first turn).

    Returns:
        A dict matching the LearnResponse schema.
    """
    prompt = f"""
You are an Adaptive Learning Assistant. You help users learn concepts through step-by-step teaching.

INPUT CONTEXT:
- Topic: {topic}
- User Level: {user_level}
- Current Step: {step_number}
- Learning Path: {json.dumps(steps_array)}
- Last Question: {last_question}
- User Answer: {user_answer}

RULES:
1. If Learning Path is empty, generate 3 to 5 progressive learning steps.
2. If User Answer is empty, teach the current step simply using a real-world analogy and ask exactly ONE question.
3. If User Answer exists, evaluate it as 'correct', 'partial', or 'incorrect'. Provide feedback and decide next_action ('advance', 'retry', 'simplify').
4. Keep the response concise, structured, interactive — no long paragraphs.
5. YOU MUST RETURN ONLY STRICT JSON MATCHING THIS EXACT FORMAT:

{{
  "step": number,
  "explanation": "string",
  "analogy": "string",
  "question": "string",
  "evaluation": {{
    "result": "correct/partial/incorrect/null",
    "feedback": "string"
  }},
  "next_action": "advance/retry/simplify"
}}
"""

    _fallback = {
        "step": step_number,
        "explanation": "",
        "analogy": "",
        "question": "",
        "evaluation": {"result": "null", "feedback": ""},
        "next_action": "retry",
    }

    try:
        model = _get_model(response_mime_type="application/json")
        response = model.generate_content(prompt)
        return json.loads(response.text)
    except EnvironmentError as exc:
        logger.error("API key not configured: %s", exc)
        _fallback["explanation"] = str(exc)
        return _fallback
    except json.JSONDecodeError:
        logger.error("Gemini returned non-JSON response")
        _fallback["explanation"] = "Received an unexpected response from the AI. Please try again."
        return _fallback
    except Exception as exc:
        logger.exception("Unexpected error in adaptive_learning_agent")
        _fallback["explanation"] = f"Error communicating with AI: {exc}"
        return _fallback
