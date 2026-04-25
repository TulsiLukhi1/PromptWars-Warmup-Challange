import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services import get_adaptive_response, sanitize_input

logger = logging.getLogger(__name__)

class AdaptiveLearningView(APIView):
    """
    Production-grade endpoint for the Adaptive Learning Assistant.
    
    Security Features:
    - Input Sanitization: Strips HTML and limits length.
    - Error Isolation: Service errors don't leak stack traces.
    - Structured Logging: Tracks topic popularity and error rates.
    """
    
    def post(self, request):
        try:
            # 1. Extraction & Initial Sanitization
            data = request.data
            topic = sanitize_input(data.get('topic', ''), 150)
            user_level = data.get('user_level', 'Beginner')
            step = int(data.get('step', 1))
            learning_path = data.get('learning_path', [])
            last_question = data.get('last_question', '')
            user_answer = sanitize_input(data.get('user_answer', ''), 1500)

            # 2. Level Validation (Whitelist approach)
            if user_level not in ['Beginner', 'Intermediate', 'Advanced']:
                user_level = 'Beginner'

            # 3. Execution via Resilient Service Layer
            result = get_adaptive_response(
                topic=topic,
                user_level=user_level,
                step_number=step,
                steps_array=learning_path,
                last_question=last_question,
                user_answer=user_answer
            )

            # 4. Observability
            logger.info(f"Session processed: topic='{topic}' step={step} action={result.get('next_action')}")
            
            return Response(result, status=status.HTTP_200_OK)

        except ValueError as e:
            logger.warning(f"Validation error: {e}")
            return Response(
                {"error": "Invalid input format. Step must be a number."},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            # Critical: Log the real error internally, but return a generic message to the user.
            # Never leak implementation details in production.
            logger.exception("Unexpected failure in AdaptiveLearningView")
            return Response(
                {"error": "An internal service error occurred. Please try again later."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class HealthCheckView(APIView):
    """Simple endpoint for Cloud Run health probes."""
    def get(self, request):
        return Response({"status": "healthy"}, status=status.HTTP_200_OK)
