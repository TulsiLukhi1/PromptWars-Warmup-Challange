from django.urls import path
from . import views

urlpatterns = [
    path('chat/', views.chat, name='chat'),
    path('learn/', views.learn, name='learn'),
    path('health/', views.health, name='health'),
]
