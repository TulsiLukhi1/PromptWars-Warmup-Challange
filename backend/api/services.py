"""
Adaptive Learning Service — powered by Google Gemini

This module provides:
  - get_ai_response()         : simple single-turn Q&A
  - adaptive_learning_agent() : multi-turn, context-aware tutoring session

Design principles
-----------------
* Single model configuration point (_get_model) — swap model names in one place.
* Structured JSON output enforced by Gemini's response_mime_type.
* Typed fallback dicts ensure the API layer always returns valid data.
* All errors are caught and logged; the caller never sees a raw exception.
"""

import os
import json
import logging

import google.generativeai as genai

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────

def _get_model(*, json_mode: bool = False) -> genai.GenerativeModel:
    """
    Configure the Gemini SDK and return a ready-to-use model.

    Args:
        json_mode: When True, instructs the model to return strict JSON.

    Raises:
        EnvironmentError: If GEMINI_API_KEY is missing or a placeholder.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "dummy_key_for_now":
        raise EnvironmentError(
            "A valid GEMINI_API_KEY environment variable is required."
        )

    genai.configure(api_key=api_key)

    generation_config: dict = {}
    if json_mode:
        generation_config["response_mime_type"] = "application/json"

    return genai.GenerativeModel(
        "gemini-flash-latest",
        generation_config=generation_config,
    )


def _make_error_response(step: int, message: str) -> dict:
    """Return a safe fallback LearnResponse dict on any failure."""
    return {
        "step":        step,
        "explanation": message,
        "analogy":     "",
        "question":    "",
        "evaluation":  {"result": "null", "feedback": ""},
        "next_action": "retry",
        "learning_path": [],
    }


# ─────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────

def get_ai_response(prompt: str) -> str:
    """
    Send a plain-text prompt to Gemini and return the text response.

    Args:
        prompt: The user's question or instruction (already validated).

    Returns:
        The model's plain-text answer, or an error string.
    """
    try:
        model = _get_model()
        response = model.generate_content(prompt)
        logger.info("get_ai_response: %d input chars → %d output chars",
                    len(prompt), len(response.text))
        return response.text

    except EnvironmentError as exc:
        logger.error("API key error in get_ai_response: %s", exc)
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
    Drive a step-by-step, context-aware tutoring session.

    Decision logic (executed inside the model prompt):
    - No learning_path yet  → generate 3–5 progressive steps and teach step 1.
    - No user_answer        → teach the current step; ask exactly one question.
    - user_answer provided  → evaluate the answer (correct / partial / incorrect);
                              set next_action to advance / retry / simplify accordingly.

    The model response is enforced as strict JSON via Gemini's response_mime_type.
    If the JSON cannot be parsed a safe fallback dict is returned so the frontend
    never receives an unhandled exception.

    Args:
        topic:         Subject the user wants to learn.
        user_level:    'Beginner', 'Intermediate', or 'Advanced'.
        step_number:   Current step in the session (1-indexed).
        steps_array:   Previously generated learning path steps.
        last_question: The question asked in the previous turn (empty on first turn).
        user_answer:   The user's reply to that question (empty on first turn).

    Returns:
        A dict conforming to the LearnResponse schema.
    """
    # ── Determine session phase ────────────────────────────
    is_first_turn   = not steps_array
    is_eval_turn    = bool(user_answer.strip())
    phase_hint      = _phase_description(is_first_turn, is_eval_turn)
    difficulty_hint = _difficulty_hint(user_level)

    prompt = f"""
You are an expert Adaptive Learning Assistant powered by Google Gemini AI.
Your role is to deliver a highly personalised, step-by-step tutoring experience.

═══════════════════════════ SESSION CONTEXT ═══════════════════════════
Topic        : {topic}
Level        : {user_level}
Current Step : {step_number}
Learning Path: {json.dumps(steps_array) if steps_array else "(not yet generated)"}
Last Question: {last_question or "(none — first turn)"}
User Answer  : {user_answer  or "(none — awaiting first response)"}
Phase        : {phase_hint}
═══════════════════════════════════════════════════════════════════════

DECISION RULES — follow these exactly:

1. GENERATE PATH (if Learning Path is empty):
   • Analyse the topic and level.
   • Create {difficulty_hint} learning steps as a concise array of step titles.
   • Then immediately TEACH step 1.

2. TEACH (if User Answer is empty):
   • Explain the current step simply and clearly (3–5 sentences max).
   • Provide ONE vivid real-world analogy that a {user_level} student can relate to.
   • Ask exactly ONE specific, open-ended comprehension question.
   • Set evaluation.result = "null".

3. EVALUATE (if User Answer is provided):
   • Compare the answer against what was taught in the last question.
   • Rate strictly: "correct", "partial", or "incorrect".
   • Provide short, encouraging, constructive feedback (1–2 sentences).
   • Decide next_action:
       - "advance"  → correct or strong partial answer
       - "retry"    → partial or incorrect answer (retry same step)
       - "simplify" → incorrect AND user seems confused (try a simpler explanation)
   • If advancing, increment step by 1 in your response.

STYLE RULES:
• Write in a warm, friendly, conversational tone — like a knowledgeable friend, not a textbook.
• On the very first turn, open with a short welcoming sentence (e.g. "Great choice! Let's explore Python together.").
• NO bullet points, NO headers, NO markdown, NO emoji in explanation/analogy — plain flowing prose only.
• The analogy must start naturally (e.g. "Think of it like..." or "Imagine...") — NOT as a labelled field.
• The question should feel like a natural follow-on curiosity, not a formal quiz question.
• Keep responses concise — 2–4 sentences per field maximum.
• Adapt vocabulary and depth strictly to the user's {user_level} level.

RETURN ONLY THIS EXACT JSON — no extra text, no markdown wrapper:

{{
  "step":     <current or next step number as integer>,
  "explanation": "<plain text, 3–5 sentences>",
  "analogy":     "<one vivid real-world analogy>",
  "question":    "<one specific comprehension question ending with ?>",
  "evaluation": {{
    "result":   "<correct | partial | incorrect | null>",
    "feedback": "<1–2 sentences of feedback, empty string on first teach>"
  }},
  "next_action":   "<advance | retry | simplify>",
  "learning_path": [<array of step title strings>]
}}
"""

    try:
        model = _get_model(json_mode=True)
        response = model.generate_content(prompt)

        data = json.loads(response.text)

        logger.info(
            "adaptive_learning_agent: topic=%r level=%s step=%d→%s action=%s",
            topic, user_level, step_number,
            data.get("step"), data.get("next_action"),
        )
        return data

    except EnvironmentError as exc:
        logger.error("API key error in adaptive_learning_agent: %s", exc)
        return _make_error_response(step_number, str(exc))

    except json.JSONDecodeError:
        logger.error("Gemini returned non-JSON in adaptive_learning_agent")
        return _make_error_response(
            step_number,
            "The AI returned an unexpected format. Please try again.",
        )

    except Exception as exc:
        logger.exception("Unexpected error in adaptive_learning_agent")
        return _make_error_response(step_number, f"Error communicating with AI: {exc}")


# ─────────────────────────────────────────────────────────────
# Private prompt-builder helpers
# ─────────────────────────────────────────────────────────────

def _phase_description(is_first_turn: bool, is_eval_turn: bool) -> str:
    if is_first_turn:
        return "SESSION START — generate learning path and teach step 1"
    if is_eval_turn:
        return "EVALUATION — assess user answer and decide next action"
    return "TEACHING — explain current step and ask a question"


def _difficulty_hint(user_level: str) -> str:
    hints = {
        "Beginner":     "3 foundational",
        "Intermediate": "4 progressively challenging",
        "Advanced":     "5 in-depth and nuanced",
    }
    return hints.get(user_level, "3 to 5")
