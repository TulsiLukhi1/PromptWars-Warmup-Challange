from rest_framework.decorators import api_view
from rest_framework.response import Response
from .services import get_ai_response, adaptive_learning_agent

@api_view(['POST'])
def chat(request):
    prompt = request.data.get('prompt')
    if not prompt:
        return Response({'error': 'Prompt is required'}, status=400)
    
    # Process through our AI service
    answer = get_ai_response(prompt)
    
    return Response({
        'prompt': prompt,
        'response': answer
    })

@api_view(['POST'])
def learn(request):
    data = request.data
    topic = data.get('topic', '')
    user_level = data.get('user_level', 'Beginner')
    step_number = data.get('step', 1)
    steps_array = data.get('learning_path', [])
    last_question = data.get('last_question', '')
    user_answer = data.get('user_answer', '')

    if not topic:
        return Response({'error': 'Topic is required'}, status=400)
        
    ai_response = adaptive_learning_agent(
        topic, user_level, step_number, steps_array, last_question, user_answer
    )
    
    return Response(ai_response)

@api_view(['GET'])
def health(request):
    return Response({'status': 'ok'})
