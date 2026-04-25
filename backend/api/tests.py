from django.test import TestCase
from unittest.mock import MagicMock
from .services import LearningAgent, SecurityGuard

class LearningAgentTests(TestCase):
    """
    Demonstrates how the refactored LearningAgent is easily testable
    via Dependency Injection (mocking the AI model).
    """

    def setUp(self):
        # Mocking the AI Model to avoid real API calls during tests
        self.mock_model = MagicMock()
        self.agent = LearningAgent(model=self.mock_model)

    def test_security_sanitization(self):
        """Verify that XSS tags and length limits are enforced."""
        dirty_input = "<script>alert('xss')</script> This is a very long text that should be clamped."
        clean = SecurityGuard.sanitize(dirty_input, 10)
        self.assertEqual(clean, "alert('xss")  # Tags stripped, length clamped

    def test_agent_schema_validation(self):
        """Verify the agent handles malformed AI JSON gracefully."""
        # Setup mock to return valid-looking JSON
        mock_response = MagicMock()
        mock_response.text = '{"step": 2, "explanation": "Success", "next_action": "advance"}'
        self.mock_model.generate_content.return_value = mock_response

        context = {'topic': 'Python', 'user_level': 'Beginner'}
        result = self.agent.process_turn(context)

        self.assertEqual(result['step'], 2)
        self.assertEqual(result['explanation'], "Success")
        # Check that missing keys were added as defaults by _validate_schema
        self.assertIn('evaluation', result)
        self.assertIn('learning_path', result)

    def test_agent_fallback_on_failure(self):
        """Verify the agent returns a fallback response when AI fails."""
        self.mock_model.generate_content.side_effect = Exception("API Down")
        
        result = self.agent.process_turn({'step': 5})
        
        self.assertEqual(result['step'], 5)
        self.assertEqual(result['next_action'], 'retry')
        self.assertIn("error", result['explanation'].lower())

class APIEndpointTests(TestCase):
    """Basic integration tests for the API views."""
    
    def test_health_check(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "healthy"})
