from django.test import TestCase, Client
from django.urls import reverse
import json

class LearnEndpointTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_learn_endpoint_missing_topic(self):
        # Testing error response when topic is missing
        response = self.client.post(
            reverse('learn'), 
            data=json.dumps({"user_level": "Beginner"}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['error'], 'Topic is required')
    
    def test_learn_endpoint_valid_request(self):
        # Testing a valid initial learn request (expecting dummy/stub behavior or mocked behavior)
        response = self.client.post(
            reverse('learn'),
            data=json.dumps({
                "topic": "Python",
                "user_level": "Beginner",
                "step": 1,
                "learning_path": [],
                "last_question": "",
                "user_answer": ""
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("step", data)
        self.assertIn("explanation", data)
