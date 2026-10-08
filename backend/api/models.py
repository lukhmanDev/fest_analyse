from django.conf import settings
from django.db import models


class Festival(models.Model):
    name = models.CharField(max_length=150)
    date = models.DateField()
    location = models.CharField(max_length=200)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'id']

    def __str__(self):
        return self.name
