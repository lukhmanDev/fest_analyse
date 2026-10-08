from rest_framework.permissions import BasePermission

ROLE_NAMES = ('Admin', 'Staff', 'Viewer')


def role_for(user):
    if user.is_superuser:
        return 'Admin'
    groups = {group.name for group in user.groups.all()}
    for role in ROLE_NAMES:
        if role in groups:
            return role
    return 'Viewer'


def user_data(user):
    role = role_for(user)
    return {
        'id': user.pk, 'username': user.get_username(),
        'role': role, 'is_superuser': user.is_superuser,
        'permissions': {'manage_users': role == 'Admin', 'create_festival': role in ('Admin', 'Staff')},
    }


class IsWorkspaceAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and role_for(request.user) == 'Admin'


class CanAccessFestivals(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.method in ('GET', 'HEAD', 'OPTIONS') or role_for(request.user) in ('Admin', 'Staff')
        )
