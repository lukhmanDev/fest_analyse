from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken


class AuthenticationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user(username='tester', password='test-password-432')

    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)

    def post(self, path, data=None):
        token = self.client.get('/api/auth/csrf/').json()['csrfToken']
        return self.client.post('/api/auth/' + path + '/', data or {}, content_type='application/json', HTTP_X_CSRFTOKEN=token)

    def login(self):
        return self.post('login', {'username': 'tester', 'password': 'test-password-432'})

    def test_login_issues_jwt_without_django_session(self):
        result = self.login()
        self.assertEqual(result.status_code, 200)
        self.assertNotIn('refresh', result.json())
        access = result.json()['access']
        self.assertEqual(AccessToken(access)['token_type'], 'access')
        self.assertNotIn(settings.SESSION_COOKIE_NAME, result.cookies)
        cookie = result.cookies[settings.JWT_REFRESH_COOKIE]
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['samesite'], 'Strict')
        self.assertEqual(cookie['path'], '/api/auth/')
        result = self.client.get('/api/auth/me/', HTTP_AUTHORIZATION='Bearer ' + access)
        self.assertEqual(result.json()['user']['username'], 'tester')

    def test_protected_endpoint_rejects_missing_invalid_expired_and_refresh_tokens(self):
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
        expired = AccessToken.for_user(self.user)
        expired.set_exp(lifetime=timedelta(seconds=-1))
        for token in ['invalid', str(expired), str(RefreshToken.for_user(self.user))]:
            self.assertEqual(self.client.get('/api/auth/me/', HTTP_AUTHORIZATION='Bearer ' + token).status_code, 401)
        self.client.force_login(self.user)
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)

    def test_refresh_rotates_and_rejects_reuse(self):
        self.login()
        old = self.client.cookies[settings.JWT_REFRESH_COOKIE].value
        result = self.post('refresh')
        self.assertEqual(result.status_code, 200)
        self.assertIn('access', result.json())
        self.assertNotEqual(old, result.cookies[settings.JWT_REFRESH_COOKIE].value)
        self.client.cookies[settings.JWT_REFRESH_COOKIE] = old
        self.assertEqual(self.post('refresh').status_code, 401)

    def test_logout_revokes_refresh_and_clears_cookie(self):
        self.login()
        old = self.client.cookies[settings.JWT_REFRESH_COOKIE].value
        result = self.post('logout')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.cookies[settings.JWT_REFRESH_COOKIE]['max-age'], 0)
        self.client.cookies[settings.JWT_REFRESH_COOKIE] = old
        self.assertEqual(self.post('refresh').status_code, 401)
        self.assertEqual(self.post('logout').status_code, 200)

    def test_invalid_and_expired_refresh(self):
        self.assertEqual(self.post('refresh').status_code, 401)
        expired = RefreshToken.for_user(self.user)
        expired.set_exp(lifetime=timedelta(seconds=-1))
        for token in ['invalid', str(expired)]:
            self.client.cookies[settings.JWT_REFRESH_COOKIE] = token
            self.assertEqual(self.post('refresh').status_code, 401)

    def test_inactive_and_deleted_accounts_cannot_refresh(self):
        self.login()
        get_user_model().objects.filter(pk=self.user.pk).update(is_active=False)
        self.assertEqual(self.post('refresh').status_code, 401)
        get_user_model().objects.filter(pk=self.user.pk).update(is_active=True)
        self.login()
        get_user_model().objects.filter(pk=self.user.pk).delete()
        self.assertEqual(self.post('refresh').status_code, 401)

    def test_bad_credentials_and_inactive_users(self):
        self.assertEqual(self.post('login', {'username': 'tester', 'password': 'wrong'}).status_code, 401)
        get_user_model().objects.filter(pk=self.user.pk).update(is_active=False)
        self.assertEqual(self.login().status_code, 401)

    def test_csrf_required_for_cookie_endpoints(self):
        for action in ['login', 'refresh', 'logout']:
            path = '/api/auth/' + action + '/'
            self.assertEqual(self.client.post(path, {}, content_type='application/json').status_code, 403)
            self.assertEqual(self.client.get(path).status_code, 405)
        self.assertEqual(self.client.post('/api/auth/login/', {}, content_type='application/json', HTTP_ORIGIN='https://attacker.example').status_code, 403)

    def test_invalid_payloads(self):
        for data in [[], {'username': 123, 'password': 'test'}, {'username': 'tester'}, {'username': ' ', 'password': 'test'}]:
            self.assertEqual(self.post('login', data).status_code, 400)
        token = self.client.get('/api/auth/csrf/').json()['csrfToken']
        self.assertEqual(self.client.post('/api/auth/login/', '{', content_type='application/json', HTTP_X_CSRFTOKEN=token).status_code, 400)

    def test_frontend_origins_support_login_refresh_and_logout(self):
        for origin in ['http://localhost:5173', 'http://127.0.0.1:5173']:
            with self.subTest(origin=origin):
                client = Client(enforce_csrf_checks=True, HTTP_HOST='127.0.0.1:8000')
                for action in ['login', 'refresh', 'logout']:
                    token = client.get('/api/auth/csrf/').json()['csrfToken']
                    response = client.post(
                        '/api/auth/' + action + '/',
                        {'username': 'tester', 'password': 'test-password-432'},
                        content_type='application/json',
                        HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN=origin,
                    )
                    self.assertEqual(response.status_code, 200)

    def test_untrusted_origin_rejected_even_with_valid_csrf_token(self):
        token = self.client.get('/api/auth/csrf/').json()['csrfToken']
        response = self.client.post(
            '/api/auth/login/',
            {'username': 'tester', 'password': 'test-password-432'},
            content_type='application/json',
            HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN='https://attacker.example',
        )
        self.assertEqual(response.status_code, 403)

    def test_trusted_origin_still_requires_csrf_token(self):
        response = self.client.post(
            '/api/auth/login/', {}, content_type='application/json',
            HTTP_ORIGIN='http://localhost:5173',
        )
        self.assertEqual(response.status_code, 403)

    @override_settings(JWT_COOKIE_SECURE=True)
    def test_production_cookie_is_secure_and_response_not_cached(self):
        result = self.login()
        self.assertTrue(result.cookies[settings.JWT_REFRESH_COOKIE]['secure'])
        self.assertIn('no-store', result['Cache-Control'])
