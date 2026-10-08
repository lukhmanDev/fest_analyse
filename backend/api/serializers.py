from rest_framework import serializers

from .models import Festival
from .roles import ROLE_NAMES


class FestivalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Festival
        fields = ['id', 'name', 'date', 'location', 'created_at']
        read_only_fields = ['id', 'created_at']


class RoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=ROLE_NAMES)
