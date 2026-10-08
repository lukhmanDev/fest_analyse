import json

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.exceptions import ObjectDoesNotExist
from django.http import JsonResponse
from django.middleware.csrf import get_token, rotate_token
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Festival
from .roles import ROLE_NAMES, CanAccessFestivals, IsWorkspaceAdmin, user_data
from .serializers import FestivalSerializer, RoleSerializer


@require_GET
def health(request):
    return JsonResponse({'status': 'ok', 'message': 'Django backend is connected.'})


@never_cache
@require_GET
def csrf(request):
    return JsonResponse({'csrfToken': get_token(request)})


def clear_refresh(response):
    response.delete_cookie(settings.JWT_REFRESH_COOKIE, path='/api/auth/', samesite='Strict')
    return response


def token_response(data):
    response = JsonResponse({'access': data['access']})
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE, data['refresh'],
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=True, secure=settings.JWT_COOKIE_SECURE,
        samesite='Strict', path='/api/auth/',
    )
    return response


def revoke_cookie(request):
    token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
    if token:
        try:
            RefreshToken(token).blacklist()
        except TokenError:
            pass


@never_cache
@require_POST
def sign_in(request):
    try:
        data = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({'message': 'Invalid request.'}, status=400)
    if not isinstance(data, dict):
        return JsonResponse({'message': 'Invalid request.'}, status=400)
    username, password = data.get('username'), data.get('password')
    if (not isinstance(username, str) or not isinstance(password, str)
            or not username.strip() or not password
            or len(username) > 150 or len(password) > 4096):
        return JsonResponse({'message': 'Enter a valid username and password.'}, status=400)
    serializer = TokenObtainPairSerializer(data={'username': username.strip(), 'password': password})
    try:
        serializer.is_valid(raise_exception=True)
    except APIException:
        return JsonResponse({'message': 'Incorrect username or password.'}, status=401)
    revoke_cookie(request)
    rotate_token(request)
    return token_response(serializer.validated_data)


@never_cache
@require_POST
def refresh(request):
    token = request.COOKIES.get(settings.JWT_REFRESH_COOKIE)
    if not token:
        return clear_refresh(JsonResponse({'message': 'Please sign in.'}, status=401))
    serializer = TokenRefreshSerializer(data={'refresh': token})
    try:
        serializer.is_valid(raise_exception=True)
    except (TokenError, APIException, ObjectDoesNotExist):
        return clear_refresh(JsonResponse({'message': 'Your login has expired. Please sign in again.'}, status=401))
    return token_response(serializer.validated_data)


@never_cache
@require_POST
def sign_out(request):
    revoke_cookie(request)
    return clear_refresh(JsonResponse({'message': 'Signed out.'}))


@never_cache
@api_view(['GET'])
def me(request):
    return Response({'user': user_data(request.user)})


@never_cache
@api_view(['GET'])
def dashboard(request):
    festivals = Festival.objects.all()
    today = timezone.localdate()
    return Response({
        'user': user_data(request.user),
        'stats': {
            'total': festivals.count(),
            'upcoming': festivals.filter(date__gte=today).count(),
            'past': festivals.filter(date__lt=today).count(),
        },
        'festivals': FestivalSerializer(festivals, many=True).data,
    })


@never_cache
@api_view(['POST'])
@permission_classes([CanAccessFestivals])
def create_festival(request):
    serializer = FestivalSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(created_by=request.user)
    return Response(serializer.data, status=201)


@never_cache
@api_view(['GET'])
@permission_classes([IsWorkspaceAdmin])
def users(request):
    return Response({'users': [user_data(user) for user in get_user_model().objects.prefetch_related('groups').order_by('username')]})


@never_cache
@api_view(['PATCH'])
@permission_classes([IsWorkspaceAdmin])
def update_role(request, user_id):
    serializer = RoleSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        user = get_object_or_404(get_user_model().objects.select_for_update(), pk=user_id)
        if user.pk == request.user.pk or user.is_superuser:
            return Response({'detail': 'Your own role and superuser roles cannot be changed here.'}, status=403)
        group, _ = Group.objects.get_or_create(name=serializer.validated_data['role'])
        user.groups.remove(*Group.objects.filter(name__in=ROLE_NAMES))
        user.groups.add(group)
    return Response({'user': user_data(user)})
