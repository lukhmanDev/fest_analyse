from django.urls import path
from .views import csrf, health, me, refresh, sign_in, sign_out
from .views import create_festival, dashboard, update_role, users

urlpatterns = [
    path('dashboard/', dashboard, name='dashboard'),
    path('festivals/', create_festival, name='create-festival'),
    path('users/', users, name='users'),
    path('users/<int:user_id>/role/', update_role, name='update-role'),
    path('health/', health, name='health'),
    path('auth/csrf/', csrf, name='csrf'),
    path('auth/login/', sign_in, name='login'),
    path('auth/refresh/', refresh, name='refresh'),
    path('auth/me/', me, name='me'),
    path('auth/logout/', sign_out, name='logout'),
]
