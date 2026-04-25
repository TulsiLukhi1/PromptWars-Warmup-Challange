from django.urls import path
from .views import AdaptiveLearningView, HealthCheckView

urlpatterns = [
    path('learn/', AdaptiveLearningView.as_view(), name='learn'),
    path('health/', HealthCheckView.as_view(), name='health'),
]
