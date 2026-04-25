import os
import json
import google.generativeai as genai

def get_ai_response(prompt: str) -> str:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or api_key == "dummy_key_for_now":
        return "This is a stub response. Please configure a valid GEMINI_API_KEY."
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error communicating with AI: {str(e)}"

def adaptive_learning_agent(topic: str, user_level: str, step_number: int, steps_array: list, last_question: str, user_answer: str) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or api_key == "dummy_key_for_now":
        return {
            "step": step_number,
            "explanation": "This is a stub response. Please configure a valid GEMINI_API_KEY.",
            "analogy": "",
            "question": "What is 2+2?",
            "evaluation": {"result": "null", "feedback": ""},
            "next_action": "advance"
        }
    
    genai.configure(api_key=api_key)
    
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
4. Keep the response concise, structured, interactive, no long paragraphs.
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

    model = genai.GenerativeModel('gemini-1.5-flash', generation_config={"response_mime_type": "application/json"})
    
    try:
        response = model.generate_content(prompt)
        return json.loads(response.text)
    except Exception as e:
        return {
            "step": step_number,
            "explanation": f"Error communicating with AI: {str(e)}",
            "analogy": "",
            "question": "",
            "evaluation": {"result": "null", "feedback": ""},
            "next_action": "retry"
        }
