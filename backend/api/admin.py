from django.contrib import admin
from .models import Festival


@admin.register(Festival)
class FestivalAdmin(admin.ModelAdmin):
    list_display = ['name', 'date', 'location', 'created_by']
    search_fields = ['name', 'location']
