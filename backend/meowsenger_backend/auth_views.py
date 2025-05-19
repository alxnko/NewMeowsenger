from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from .serializers import RegisterSerializer, UserSerializer, LoginSerializer
from django.conf import settings

# Cookie configuration constants
COOKIE_NAME = "meowsenger_auth_token"
COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days
COOKIE_PATH = "/"


class RegisterView(generics.CreateAPIView):
    """
    View for registering a new user.
    Returns an auth token upon successful registration.
    """

    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Create token for the new user
        token, created = Token.objects.get_or_create(user=user)

        # Return token in response
        return Response(
            {"token": token.key, "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """
    View for authenticating a user.
    Returns an auth token upon successful login.
    """

    permission_classes = [permissions.AllowAny]
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        username = serializer.validated_data["username"]
        password = serializer.validated_data["password"]

        user = authenticate(username=username, password=password)

        if user:
            token, created = Token.objects.get_or_create(user=user)
            return Response({"token": token.key, "user": UserSerializer(user).data})

        return Response(
            {"error": "Invalid username or password"},
            status=status.HTTP_401_UNAUTHORIZED,
        )


class LogoutView(APIView):
    """
    View for logging out a user.
    Requires an active authentication token.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        # Delete the user's auth token to log them out
        try:
            request.user.auth_token.delete()

            # Also clear cookie just in case
            response = Response({"status": True}, status=status.HTTP_200_OK)
            response.delete_cookie(COOKIE_NAME, path=COOKIE_PATH)
            return response
        except Exception as e:
            return Response(
                {"status": False, "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class UserPreferencesView(APIView):
    """
    View for updating user preferences (theme and language).
    Requires authentication.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        """Return the current user's preferences"""
        user = request.user
        serializer = UserSerializer(user)
        return Response(
            {
                "language": serializer.data.get("language", "en"),
                "theme": serializer.data.get("theme", "light"),
            }
        )

    def put(self, request, *args, **kwargs):
        """Update the user's preferences"""
        user = request.user

        # Get preferences from request
        language = request.data.get("language")
        theme = request.data.get("theme")

        # Update user with valid preferences
        if language and language in ["en", "ru", "kg"]:
            user.language = language

        if theme and theme in ["light", "dark"]:
            user.theme = theme

        user.save()

        # Return updated preferences
        serializer = UserSerializer(user)
        return Response(
            {
                "language": serializer.data.get("language"),
                "theme": serializer.data.get("theme"),
            }
        )


class SetTokenCookieView(APIView):
    """
    Sets a secure HTTP-only cookie containing the authentication token.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        token = request.data.get("token")
        if not token:
            return Response(
                {"error": "Token is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Validate that the token exists in the database
        try:
            Token.objects.get(key=token)
        except Token.DoesNotExist:
            return Response(
                {"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Set the token as a secure HTTP-only cookie
        response = Response({"status": "Token cookie set"})

        # Set secure properties for the cookie
        response.set_cookie(
            COOKIE_NAME,
            token,
            max_age=COOKIE_MAX_AGE,
            httponly=True,  # Not accessible via JavaScript
            samesite="Lax",  # Helps prevent CSRF
            secure=settings.SESSION_COOKIE_SECURE,  # True in production
            path=COOKIE_PATH,
            expires=None,  # Let max_age control expiration
        )

        return response


class ClearTokenCookieView(APIView):
    """
    Clears the authentication token cookie.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        response = Response({"status": "Token cookie cleared"})
        response.delete_cookie(COOKIE_NAME, path=COOKIE_PATH)
        return response


class GetTokenFromCookieView(APIView):
    """
    Returns the token from the HTTP-only cookie.
    This allows the frontend to initialize with a token from cookie.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        token = request.COOKIES.get(COOKIE_NAME)

        # If token exists, validate it exists in the database
        if token:
            try:
                Token.objects.get(key=token)
                return Response({"token": token})
            except Token.DoesNotExist:
                # Invalid token, clear the cookie
                response = Response({"token": None})
                response.delete_cookie(COOKIE_NAME, path=COOKIE_PATH)
                return response

        return Response({"token": None})
