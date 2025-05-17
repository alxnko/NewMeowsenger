from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from .serializers import RegisterSerializer, UserSerializer, LoginSerializer


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
            return Response({"status": True}, status=status.HTTP_200_OK)
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
