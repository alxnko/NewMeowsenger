"""
URL configuration for meowsenger_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .auth_views import RegisterView, LoginView, LogoutView
from . import chat_views


# Simple health check view
@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    try:
        # Test database connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        status = "healthy"
    except Exception as e:
        status = f"unhealthy: {str(e)}"

    return Response({"status": status})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("auth/", include("django.contrib.auth.urls")),
    # Health check endpoint
    path("health/", health_check, name="health_check"),
    # Authentication endpoints
    path("api/register/", RegisterView.as_view(), name="register"),
    path("api/login/", LoginView.as_view(), name="login"),
    path("api/logout/", LogoutView.as_view(), name="logout"),
    # Chat endpoints
    path("api/c/get_chats", chat_views.get_chats, name="get_chats"),
    path("api/c/get_chat", chat_views.get_chat, name="get_chat"),
    path("api/c/create_group", chat_views.create_group, name="create_group"),
    path("api/c/remove_group", chat_views.remove_group, name="remove_group"),
    path("api/c/leave_group", chat_views.leave_group, name="leave_group"),
    path("api/c/get_group", chat_views.get_group, name="get_group"),
    path("api/c/add_member", chat_views.add_member, name="add_member"),
    path("api/c/remove_member", chat_views.remove_member, name="remove_member"),
    path("api/c/add_admin", chat_views.add_admin, name="add_admin"),
    path("api/c/remove_admin", chat_views.remove_admin, name="remove_admin"),
    path("api/c/save_settings", chat_views.save_settings, name="save_settings"),
    path(
        "api/c/get_older_messages",
        chat_views.get_older_messages,
        name="get_older_messages",
    ),
]
