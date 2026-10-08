from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import Client, TestCase
from rest_framework_simplejwt.tokens import AccessToken

from .models import Festival


class RoleAccessTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = get_user_model().objects.create_user(username='owner', is_superuser=True)
        cls.staff = get_user_model().objects.create_user(username='staff')
        cls.viewer = get_user_model().objects.create_user(username='viewer')
        cls.other = get_user_model().objects.create_user(username='other')
        cls.staff.groups.add(Group.objects.get(name='Staff'))

    def client_for(self, user):
        return Client(HTTP_AUTHORIZATION='Bearer ' + str(AccessToken.for_user(user)))

    def test_dashboard_requires_jwt_and_shows_live_role(self):
        self.assertEqual(self.client.get('/api/dashboard/').status_code, 401)
        for user, role in [(self.admin, 'Admin'), (self.staff, 'Staff'), (self.viewer, 'Viewer')]:
            result = self.client_for(user).get('/api/dashboard/')
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()['user']['role'], role)
            self.assertEqual(result.json()['stats']['total'], 0)

    def test_only_staff_and_admin_can_create_festivals(self):
        payload = {'name': 'Arts Fest', 'date': '2030-05-01', 'location': 'Main Hall'}
        self.assertEqual(self.client.post('/api/festivals/', payload, content_type='application/json').status_code, 401)
        self.assertEqual(self.client_for(self.viewer).post('/api/festivals/', payload, content_type='application/json').status_code, 403)
        for user in [self.admin, self.staff]:
            result = self.client_for(user).post('/api/festivals/', {**payload, 'created_by': self.viewer.pk}, content_type='application/json')
            self.assertEqual(result.status_code, 201)
            self.assertEqual(Festival.objects.get(pk=result.json()['id']).created_by_id, user.pk)
        result = self.client_for(self.viewer).get('/api/dashboard/').json()
        self.assertEqual(result['stats']['total'], 2)
        self.assertEqual(len(result['festivals']), 2)

    def test_invalid_festival_is_rejected(self):
        result = self.client_for(self.staff).post('/api/festivals/', {'name': ' ', 'date': 'invalid'}, content_type='application/json')
        self.assertEqual(result.status_code, 400)
        self.assertEqual(Festival.objects.count(), 0)

    def test_team_and_role_changes_are_admin_only(self):
        for user in [self.staff, self.viewer]:
            client = self.client_for(user)
            self.assertEqual(client.get('/api/users/').status_code, 403)
            self.assertEqual(client.patch(f'/api/users/{self.other.pk}/role/', {'role': 'Admin'}, content_type='application/json').status_code, 403)
        self.assertEqual(self.client.get('/api/users/').status_code, 401)
        client = self.client_for(self.admin)
        self.assertEqual(client.get('/api/users/').status_code, 200)
        result = client.patch(f'/api/users/{self.other.pk}/role/', {'role': 'Staff'}, content_type='application/json')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['user']['role'], 'Staff')

    def test_role_change_applies_to_existing_access_token(self):
        client = self.client_for(self.staff)
        result = self.client_for(self.admin).patch(f'/api/users/{self.staff.pk}/role/', {'role': 'Viewer'}, content_type='application/json')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(client.get('/api/auth/me/').json()['user']['role'], 'Viewer')
        self.assertEqual(client.post('/api/festivals/', {}, content_type='application/json').status_code, 403)

    def test_self_and_superuser_changes_are_blocked_and_bad_roles_rejected(self):
        self.other.groups.add(Group.objects.get(name='Admin'))
        client = self.client_for(self.other)
        for user in [self.other, self.admin]:
            self.assertEqual(client.patch(f'/api/users/{user.pk}/role/', {'role': 'Viewer'}, content_type='application/json').status_code, 403)
        self.assertEqual(client.patch(f'/api/users/{self.viewer.pk}/role/', {'role': 'SuperAdmin'}, content_type='application/json').status_code, 400)

    def test_role_change_preserves_unrelated_groups_and_admin_flags(self):
        self.viewer.groups.add(Group.objects.create(name='Finance'))
        self.client_for(self.admin).patch(f'/api/users/{self.viewer.pk}/role/', {'role': 'Admin', 'is_superuser': True}, content_type='application/json')
        self.viewer.refresh_from_db()
        self.assertTrue(self.viewer.groups.filter(name='Finance').exists())
        self.assertFalse(self.viewer.is_superuser)
        self.assertFalse(self.viewer.is_staff)
        self.assertEqual(self.client_for(self.viewer).get('/api/users/').status_code, 200)

    def test_staff_flag_alone_does_not_grant_workspace_privileges(self):
        self.viewer.is_staff = True
        self.viewer.save()
        client = self.client_for(self.viewer)
        self.assertEqual(client.get('/api/auth/me/').json()['user']['role'], 'Viewer')
        self.assertEqual(client.get('/api/users/').status_code, 403)
