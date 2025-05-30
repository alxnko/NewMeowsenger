from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.db.models import Q, Count
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
import time
import json
from datetime import datetime
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.response import Response

from .models import Chat, Message, Update, User, UserMessage

# Helper functions


def mark_as_read(chat, user):
    """Mark messages in a chat as read for the current user."""
    # In Django, we can use QuerySet operations more efficiently
    unread_messages = Message.objects.filter(chat=chat, unread_by=user).order_by("-id")

    # Remove the user from unread_by for each message
    for message in unread_messages:
        message.unread_by.remove(user)

    # No need for explicit commit in Django ORM


def mark_as_not_read(chat, msg):
    """Mark a message as unread for all users in the chat."""
    # In Django, we can use the many-to-many relationship directly
    msg.unread_by.set(chat.users.all())


def get_last_message(chat_id):
    """Get the last non-deleted message from a chat."""
    try:
        return (
            Message.objects.filter(chat_id=chat_id, is_deleted=False)
            .order_by("-id")
            .first()
        )
    except Message.DoesNotExist:
        return None


def chat_to_block_dict(chat, user):
    """Convert chat to a dictionary for the block view."""
    if chat.is_group:
        name = chat.name
        target_user = None
        is_verified = chat.is_verified
    else:
        # If chat has only the current user
        if chat.users.count() == 1:
            name = user.username
            target_user = None
        else:
            # Get the other user in the chat
            target_user = chat.users.exclude(username=user.username).first()
            name = target_user.username if target_user else "Unknown"

        is_verified = target_user.is_verified if target_user else False

    # Get the last message
    last_message = get_last_message(chat.id)

    # Check if the user has unread messages
    # The UserMessage model doesn't have is_read field - if a record exists, it means the message is unread
    has_unread = UserMessage.objects.filter(user=user, message__chat=chat).exists()

    # Get the chat's creation time
    last_time = chat.last_time if chat.last_time else chat.reg_time

    # Format the message for display
    if last_message:
        # If this is a system message, preserve its type and params
        if last_message.is_system:
            last_message_dict = {
                "text": last_message.text,
                "author": last_message.user.username,
                "isSystem": True,
                "system_message_type": last_message.system_message_type,
                "system_message_params": last_message.system_message_params,
            }
        else:
            last_message_dict = {
                "text": last_message.text,
                "author": last_message.user.username,
            }
    else:
        last_message_dict = "no messages"

    return {
        "id": chat.id,
        "name": name,
        "isGroup": chat.is_group,
        "isVerified": is_verified,
        "lastMessage": last_message_dict,
        "lastUpdate": last_time,
        "isUnread": has_unread,
    }


def user_to_dict(user):
    """Convert user to a dictionary."""
    return {
        "id": user.id,
        "username": user.username,
        "description": user.description,
        "image_file": user.image_file,
        "is_verified": user.is_verified,
        "is_admin": user.is_staff,
        "is_tester": user.is_tester,
    }


def chat_to_dict(chat, user):
    """Convert chat to a detailed dictionary."""
    if chat.is_group:
        name = chat.name
        target_user = None
        is_verified = chat.is_verified
    else:
        # If chat has only the current user
        if chat.users.count() == 1:
            name = user.username
            target_user = None
        else:
            # Get the other user in the chat
            target_user = chat.users.exclude(username=user.username).first()
            name = target_user.username if target_user else "Unknown"

        is_verified = target_user.is_verified if target_user else False

    # Get users in the chat
    if chat.is_group:
        users_list = [user_to_dict(u) for u in chat.users.all()]
    else:
        if chat.users.count() == 1:
            users_list = [{"username": user.username}]
        else:
            users_list = [
                user_to_dict(u) for u in chat.users.exclude(username=user.username)
            ]

    # Check if the user has unread messages
    # Check if there are any unread messages for this user in this chat
    is_unread = UserMessage.objects.filter(user=user, message__chat=chat).exists()

    return {
        "id": chat.id,
        "name": name,
        "desc": chat.description,
        "secret": chat.secret,
        "isVerified": is_verified,
        "isAdmin": target_user.is_staff if target_user else False,
        "isTester": target_user.is_tester if target_user else False,
        "users": users_list,
        "admins": [u.username for u in chat.admins.all()] if chat.is_group else [],
        "isGroup": chat.is_group,
        "lastUpdate": chat.last_time,
        "isUnread": is_unread,
    }


def messages_to_arr_from(chat_id, before_id=None, limit=30):
    """
    Convert chat messages to an array with pagination support.

    Args:
        chat_id: ID of the chat
        before_id: If provided, return messages before this message ID
        limit: Maximum number of messages to return
    """
    messages_query = Message.objects.filter(chat_id=chat_id)

    # If before_id is provided, only get messages with ID less than before_id
    if before_id:
        messages_query = messages_query.filter(id__lt=before_id)

    # Get messages in reverse order (newest first), then reverse back for presentation
    messages = messages_query.order_by("-id")[:limit]

    # Convert to list and reverse order for chronological display
    messages = list(reversed(messages))

    return [
        {
            "id": msg.id,
            "text": msg.text,
            "author": msg.user.username,
            "time": msg.send_time.timestamp(),
            "isDeleted": msg.is_deleted,
            "isEdited": msg.is_edited,
            "isSystem": msg.is_system,
            "system_message_type": msg.system_message_type if msg.is_system else None,
            "system_message_params": (
                msg.system_message_params if msg.is_system else None
            ),
            "replyTo": msg.reply_to,
            "isForwarded": msg.is_forwarded,
        }
        for msg in messages
    ]


def remove_group(chat):
    """Delete a group chat and all its messages."""
    # In Django, we can use cascading deletes
    # First, clear the many-to-many relationships
    chat.users.clear()
    chat.admins.clear()

    # Then delete the chat (messages will be deleted via CASCADE)
    chat.delete()


# API Views


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def get_chats(request):
    """Get all chats for the current user."""
    data = request.data
    user = request.user

    # Get user's chats ordered by last update time
    chats = Chat.objects.filter(users=user).order_by("-last_time")

    # Check if we need to return data
    if chats.count() < data.get("chats", 0):
        return Response({"status": True, "data": []})

    # Check if we have new data since the last update
    if chats.exists() and (
        chats.count() != data.get("chats", 0)
        or chats.first().last_time.timestamp() != data.get("lastUpdate", 0)
    ):
        return Response(
            {
                "status": True,
                "data": [chat_to_block_dict(chat, user) for chat in chats],
                "time": chats.first().last_time.timestamp() if chats else 0,
            }
        )

    return Response({"status": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def get_chat(request):
    """Get or create a chat with a specific user."""
    data = request.data
    user = request.user

    # Get pagination parameters if provided
    limit = int(data.get("limit", 30))
    before_id = data.get("before_id")

    # Find the target user
    target_username = data.get("from")
    target_user = User.objects.filter(username=target_username).first()

    if not target_user:
        return Response({"status": False}, status=status.HTTP_404_NOT_FOUND)

    # Self chat
    if target_user == user:
        # Check if self-chat already exists
        chat = (
            Chat.objects.filter(is_group=False, users=user)
            .annotate(user_count=Count("users"))
            .filter(user_count=1)
            .first()
        )

        if chat:
            mark_as_read(chat, user)
            last = chat.last_time.timestamp()

            # Get total messages count to help with pagination
            total_messages = Message.objects.filter(chat_id=chat.id).count()

            return Response(
                {
                    "status": True,
                    "chat": chat_to_dict(chat, user),
                    "messages": messages_to_arr_from(chat.id, before_id, limit),
                    "last": last,
                    "has_more": before_id is not None or total_messages > limit,
                    "total_messages": total_messages,
                }
            )

        # Create a new self-chat
        chat = Chat.objects.create(is_group=False)
        chat.users.add(user)
        mark_as_read(chat, user)

        last = chat.last_time.timestamp()
        return Response(
            {
                "status": True,
                "chat": chat_to_dict(chat, user),
                "messages": [],
                "last": last,
                "has_more": False,
                "total_messages": 0,
            }
        )

    # Direct chat with another user
    # Check if chat already exists
    common_chats = Chat.objects.filter(is_group=False, users=user).filter(
        users=target_user
    )

    if common_chats.exists():
        chat = common_chats.first()
        mark_as_read(chat, user)
        last = chat.last_time.timestamp()

        # Get total messages count
        total_messages = Message.objects.filter(chat_id=chat.id).count()

        return Response(
            {
                "status": True,
                "chat": chat_to_dict(chat, user),
                "messages": messages_to_arr_from(chat.id, before_id, limit),
                "last": last,
                "has_more": before_id is not None or total_messages > limit,
                "total_messages": total_messages,
            }
        )

    # Create a new chat with the target user
    chat = Chat.objects.create(is_group=False)
    chat.users.add(user, target_user)
    last = chat.last_time.timestamp()

    return Response(
        {
            "status": True,
            "chat": chat_to_dict(chat, user),
            "messages": [],
            "last": last,
            "has_more": False,
            "total_messages": 0,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_group(request):
    """Create a new group chat."""
    data = request.data
    user = request.user

    chat = Chat.objects.create(name=data.get("name"), is_group=True)

    # Add the creator as user and admin
    chat.users.add(user)
    chat.admins.add(user)

    # Add members if provided
    if "members" in data and data.get("members"):
        members = data.get("members")
        for username in members:
            try:
                member = User.objects.get(username=username)
                if member != user:  # Don't add the creator twice
                    chat.users.add(member)

                    # Create a system message to notify that user was added
                    Message.objects.create(
                        text=f"{user.username} added {member.username} to the group",
                        user=user,
                        chat=chat,
                        is_system=True,
                        system_message_type="user_added",
                        system_message_params={
                            "actor": user.username,
                            "target": member.username,
                        },
                    )
            except User.DoesNotExist:
                # Skip users that don't exist
                continue

    return Response({"status": True, "id": chat.id, "secret": chat.secret})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_group(request):
    """Delete a group chat."""
    data = request.data
    user = request.user

    # Get the chat
    try:
        chat = Chat.objects.get(pk=data.get("from"))
    except Chat.DoesNotExist:
        return Response({"status": False}, status=status.HTTP_404_NOT_FOUND)

    # Check if user is an admin
    if user in chat.admins.all():
        # Check password
        if check_password(data.get("password"), user.password):
            # Delete the chat
            remove_group(chat)
            return Response({"status": True})

    return Response({"status": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def leave_group(request):
    """Leave a group chat."""
    data = request.data
    user = request.user

    # Get the chat
    try:
        chat = Chat.objects.get(pk=data.get("from"))
    except Chat.DoesNotExist:
        return Response({"status": False}, status=status.HTTP_404_NOT_FOUND)

    # Check if user is in the chat
    if user in chat.users.all():
        chat.users.remove(user)

        # If chat is empty, delete it
        if chat.users.count() == 0:
            remove_group(chat)
        else:
            # Create system message
            msg = Message.objects.create(
                text=data.get("message"), user=user, chat=chat, is_system=True
            )

            # Mark as unread for other users
            mark_as_not_read(chat, msg)

            # Update chat's last time
            chat.last_time = timezone.now()
            chat.save()

        return Response({"status": True})

    return Response({"status": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def get_group(request):
    """Get a group chat."""
    data = request.data
    user = request.user

    # Get pagination parameters if provided
    limit = int(data.get("limit", 30))
    before_id = data.get("before_id")

    # Get the chat
    try:
        chat = Chat.objects.get(pk=data.get("from"))
    except Chat.DoesNotExist:
        return Response({"status": False}, status=status.HTTP_404_NOT_FOUND)

    # Check if it's a group chat and user is a member
    if chat.is_group and user in chat.users.all():
        mark_as_read(chat, user)
        last = chat.last_time.timestamp()

        # Get total messages count for pagination info
        total_messages = Message.objects.filter(chat_id=chat.id).count()

        return Response(
            {
                "status": True,
                "chat": chat_to_dict(chat, user),
                "messages": messages_to_arr_from(chat.id, before_id, limit),
                "last": last,
                "has_more": before_id is not None or total_messages > limit,
                "total_messages": total_messages,
            }
        )

    return Response({"status": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_member(request):
    """Add a member to a group chat."""
    data = request.data
    user = request.user

    # Get the chat
    try:
        chat = Chat.objects.get(pk=data.get("from"))
    except Chat.DoesNotExist:
        return Response({"status": False}, status=status.HTTP_404_NOT_FOUND)

    # Find the user to add
    try:
        target_user = User.objects.get(username=data.get("username"))
    except User.DoesNotExist:
        return Response({"status": False})

    # Check if it's a group chat and user is an admin
    if chat.is_group and user in chat.admins.all():
        # Add the user
        chat.users.add(target_user)

        # Create system message with proper structured data
        msg = Message.objects.create(
            text=f"{user.username} added {target_user.username} to the group",
            user=user,
            chat=chat,
            is_system=True,
            system_message_type="user_added",
            system_message_params={
                "actor": user.username,
                "target": target_user.username,
            },
        )

        # Mark as unread for other users
        mark_as_not_read(chat, msg)

        # Update chat's last time
        chat.last_time = msg.send_time
        chat.save()

        # Send WebSocket notification about user addition
        try:
            import requests

            ws_url = "http://messaging:8081/api/user-added"
            requests.post(
                ws_url,
                json={
                    "chatId": chat.id,
                    "addedByUserId": user.id,
                    "addedByUsername": user.username,
                    "targetUserId": target_user.id,
                    "targetUsername": target_user.username,
                },
                timeout=2,
            )
        except Exception as e:
            print(f"Failed to send WebSocket notification: {e}")

        return Response({"status": True})

    return Response({"status": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_member(request):
    """Remove a member from a group chat."""
    data = request.data
    user = request.user

    # Get the chat
    try:
        chat = Chat.objects.get(pk=data.get("from"))
    except Chat.DoesNotExist:
        return Response({"status": False}, status=status.HTTP_404_NOT_FOUND)

    # Find the user to remove
    try:
        target_user = User.objects.get(username=data.get("username"))
    except User.DoesNotExist:
        return Response({"status": False})

    # Check if it's a group chat, user is an admin, and target user is in the chat
    if chat.is_group and user in chat.admins.all() and target_user in chat.users.all():
        # Remove the user
        chat.users.remove(target_user)

        # Create system message with proper structured data
        msg = Message.objects.create(
            text=f"{user.username} removed {target_user.username} from the group",
            user=user,
            chat=chat,
            is_system=True,
            system_message_type="user_removed",
            system_message_params={
                "actor": user.username,
                "target": target_user.username,
            },
        )

        # Mark as unread for other users
        mark_as_not_read(chat, msg)

        # Update chat's last time
        chat.last_time = msg.send_time
        chat.save()

        # Send WebSocket notification about user removal
        try:
            import requests

            ws_url = "http://messaging:8081/api/user-removed"
            requests.post(
                ws_url,
                json={
                    "chatId": chat.id,
                    "removedByUserId": user.id,
                    "removedByUsername": user.username,
                    "targetUserId": target_user.id,
                    "targetUsername": target_user.username,
                },
                timeout=2,
            )
        except Exception as e:
            print(f"Failed to send WebSocket notification: {e}")

        return Response({"status": True})

    return Response({"status": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_admin(request):
    """Add an admin to a group chat."""
    data = request.data
    user = request.user

    # Get the chat
    try:
        chat = Chat.objects.get(pk=data.get("from"))
    except Chat.DoesNotExist:
        return Response({"status": False}, status=status.HTTP_404_NOT_FOUND)

    # Find the user to promote
    try:
        target_user = User.objects.get(username=data.get("username"))
    except User.DoesNotExist:
        return Response({"status": False})

    # Check if it's a group chat and user is the first admin
    if chat.is_group and chat.admins.all().first() == user:
        # Add the user as admin
        chat.admins.add(target_user)

        # Create system message with proper structured data
        msg = Message.objects.create(
            text=f"{user.username} made {target_user.username} an admin",
            user=user,
            chat=chat,
            is_system=True,
            system_message_type="admin_added",
            system_message_params={
                "actor": user.username,
                "target": target_user.username,
            },
        )

        # Mark as unread for other users
        mark_as_not_read(chat, msg)

        # Update chat's last time
        chat.last_time = msg.send_time
        chat.save()

        # Send WebSocket notification about admin status change
        try:
            import requests

            ws_url = "http://messaging:8081/api/admin-status-changed"
            requests.post(
                ws_url,
                json={
                    "chatId": chat.id,
                    "changedByUserId": user.id,
                    "changedByUsername": user.username,
                    "targetUserId": target_user.id,
                    "targetUsername": target_user.username,
                    "isPromotion": True,
                },
                timeout=2,
            )
        except Exception as e:
            print(f"Failed to send WebSocket notification: {e}")

        return Response({"status": True})

    return Response({"status": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_admin(request):
    """Remove admin status from a group chat user."""
    data = request.data
    user = request.user

    # Get the chat
    try:
        chat = Chat.objects.get(pk=data.get("from"))
    except Chat.DoesNotExist:
        return Response({"status": False}, status=status.HTTP_404_NOT_FOUND)

    # Find the user to demote
    try:
        target_user = User.objects.get(username=data.get("username"))
    except User.DoesNotExist:
        return Response({"status": False})

    # Check if it's a group chat, user is the first admin, target is an admin
    if (
        chat.is_group
        and chat.admins.all().first() == user
        and target_user in chat.admins.all()
        and target_user != user
    ):
        # Remove the user from admins
        chat.admins.remove(target_user)

        # Create system message with proper structured data
        msg = Message.objects.create(
            text=f"{user.username} removed admin rights from {target_user.username}",
            user=user,
            chat=chat,
            is_system=True,
            system_message_type="admin_removed",
            system_message_params={
                "actor": user.username,
                "target": target_user.username,
            },
        )

        # Mark as unread for other users
        mark_as_not_read(chat, msg)

        # Update chat's last time
        chat.last_time = msg.send_time
        chat.save()

        # Send WebSocket notification about admin status change
        try:
            import requests

            ws_url = "http://messaging:8081/api/admin-status-changed"
            requests.post(
                ws_url,
                json={
                    "chatId": chat.id,
                    "changedByUserId": user.id,
                    "changedByUsername": user.username,
                    "targetUserId": target_user.id,
                    "targetUsername": target_user.username,
                    "isPromotion": False,
                },
                timeout=2,
            )
        except Exception as e:
            print(f"Failed to send WebSocket notification: {e}")

        return Response({"status": True})

    return Response({"status": False})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_settings(request):
    """Save chat settings."""
    data = request.data
    user = request.user

    # Get the chat
    try:
        chat = Chat.objects.get(pk=data.get("id"))
    except Chat.DoesNotExist:
        return Response({"status": False}, status=status.HTTP_404_NOT_FOUND)

    # Update chat settings
    if "name" in data:
        chat.name = data.get("name")
    if "description" in data:
        chat.description = data.get("description")

    # Create system message
    msg = Message.objects.create(
        text=data.get("message"), user=user, chat=chat, is_system=True
    )

    # Mark as unread for other users
    mark_as_not_read(chat, msg)

    # Update chat's last time
    chat.last_time = msg.send_time
    chat.save()

    # Send WebSocket notification about settings change
    try:
        import requests

        ws_url = "http://messaging:8081/api/chat-settings-changed"
        requests.post(
            ws_url,
            json={
                "chatId": chat.id,
                "changedByUserId": user.id,
                "changedByUsername": user.username,
                "name": chat.name,
                "description": chat.description,
                "message": data.get("message"),
            },
            timeout=2,
        )
    except Exception as e:
        print(f"Failed to send WebSocket notification: {e}")

    return Response({"status": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def get_older_messages(request):
    """Get older messages for a chat with pagination."""
    data = request.data
    user = request.user

    # Get pagination parameters
    limit = int(data.get("limit", 30))
    before_id = data.get("before_id")
    chat_id = data.get("chat_id")

    if not chat_id or not before_id:
        return Response(
            {"status": False, "message": "chat_id and before_id are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Get the chat
    try:
        chat = Chat.objects.get(pk=chat_id)
    except Chat.DoesNotExist:
        return Response({"status": False}, status=status.HTTP_404_NOT_FOUND)

    # Check if user is a member of the chat
    if user not in chat.users.all():
        return Response({"status": False}, status=status.HTTP_403_FORBIDDEN)

    # Get messages with pagination
    messages = messages_to_arr_from(chat.id, before_id, limit)

    # Check if there are more messages to load
    has_more = False
    if messages:
        # If we got messages, check if there are older ones
        oldest_id = min(msg["id"] for msg in messages) if messages else 0
        has_more = Message.objects.filter(chat_id=chat.id, id__lt=oldest_id).exists()

    return Response({"status": True, "messages": messages, "has_more": has_more})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_group_settings(request):
    """Update group chat settings."""
    data = request.data
    user = request.user

    # Get the chat
    try:
        chat = Chat.objects.get(pk=data.get("from"))
    except Chat.DoesNotExist:
        return Response({"status": False}, status=status.HTTP_404_NOT_FOUND)

    # Check if it's a group chat and user is an admin
    if chat.is_group and user in chat.admins.all():
        # Update chat settings
        if "name" in data:
            chat.name = data.get("name")

        # Add other settings as needed
        chat.save()

        # Create system message with proper structured data
        msg = Message.objects.create(
            text=f"{user.username} updated group settings",
            user=user,
            chat=chat,
            is_system=True,
            system_message_type="group_settings_updated",
            system_message_params={"actor": user.username},
        )

        # Mark as unread for other users
        mark_as_not_read(chat, msg)

        # Update chat's last time
        chat.last_time = msg.send_time
        chat.save()

        # Send WebSocket notification about settings change
        try:
            import requests

            ws_url = "http://messaging:8081/api/settings-changed"
            requests.post(
                ws_url,
                json={
                    "chatId": chat.id,
                    "userId": user.id,
                    "username": user.username,
                    "chatName": chat.name,
                    "description": "Group settings were updated",
                },
                timeout=2,
            )
        except Exception as e:
            print(f"Failed to send WebSocket notification: {e}")

        return Response({"status": True})

    return Response({"status": False})
