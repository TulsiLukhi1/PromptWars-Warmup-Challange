import logging
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .services import get_ai_response, adaptive_learning_agent

logger = logging.getLogger(__name__)

# Constants for validation
MAX_TOPIC_LENGTH = 200
MAX_PROMPT_LENGTH = 2000
MAX_ANSWER_LENGTH = 1000
ALLOWED_LEVELS = {'Beginner', 'Intermediate', 'Advanced'}


@api_view(['POST'])
def chat(request):
    """Simple chat endpoint — sends a prompt to the AI and returns the response."""
    prompt = request.data.get('prompt', '').strip()

    if not prompt:
        return Response({'error': 'Prompt is required.'}, status=400)

    if len(prompt) > MAX_PROMPT_LENGTH:
        return Response(
            {'error': f'Prompt must be under {MAX_PROMPT_LENGTH} characters.'},
            status=400,
        )

    logger.info("Chat request received (prompt length: %d)", len(prompt))
    answer = get_ai_response(prompt)
    return Response({'prompt': prompt, 'response': answer})


@api_view(['POST'])
def learn(request):
    """Adaptive learning endpoint — drives step-by-step tutoring sessions."""
    data = request.data

    # --- Input validation ---
    topic = data.get('topic', '').strip()
    if not topic:
        return Response({'error': 'Topic is required.'}, status=400)
    if len(topic) > MAX_TOPIC_LENGTH:
        return Response(
            {'error': f'Topic must be under {MAX_TOPIC_LENGTH} characters.'},
            status=400,
        )

    user_level = data.get('user_level', 'Beginner')
    if user_level not in ALLOWED_LEVELS:
        return Response(
            {'error': f'user_level must be one of: {", ".join(sorted(ALLOWED_LEVELS))}.'},
            status=400,
        )

    step_number = data.get('step', 1)
    if not isinstance(step_number, int) or step_number < 1:
        return Response({'error': 'step must be a positive integer.'}, status=400)

    steps_array = data.get('learning_path', [])
    if not isinstance(steps_array, list):
        return Response({'error': 'learning_path must be a list.'}, status=400)

    last_question = str(data.get('last_question', '')).strip()
    user_answer = str(data.get('user_answer', '')).strip()

    if len(user_answer) > MAX_ANSWER_LENGTH:
        return Response(
            {'error': f'user_answer must be under {MAX_ANSWER_LENGTH} characters.'},
            status=400,
        )

    logger.info(
        "Learn request — topic: %r, level: %s, step: %d",
        topic, user_level, step_number,
    )

    ai_response = adaptive_learning_agent(
        topic, user_level, step_number, steps_array, last_question, user_answer
    )
    return Response(ai_response)


@api_view(['GET'])
def health(request):
    """Health check endpoint used by Cloud Run to verify the service is alive."""
    return Response({'status': 'ok'})
