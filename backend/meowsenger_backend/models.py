from django.contrib.auth.models import AbstractUser
from django.db import models
from datetime import datetime
import secrets


class User(AbstractUser):
    """
    Custom User model for the Meowsenger application.
    Extends the Django AbstractUser to include additional fields.
    """

    # Django's AbstractUser will use BigAutoField by default in newer versions
    description = models.CharField(max_length=20, default="default")
    image_file = models.CharField(max_length=20, default="default")
    rank = models.CharField(max_length=20, null=True, blank=True)
    is_tester = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    # is_admin is already in AbstractUser as is_staff
    reg_time = models.DateTimeField(default=datetime.now)
    # Django already has password, username fields
    # Django manages relationships differently, they are defined in other models

    def __str__(self):
        return f"User('{self.username}', '{self.email}', '{self.image_file}')"


class Chat(models.Model):
    id = models.BigAutoField(primary_key=True)  # Changed from AutoField to BigAutoField
    is_group = models.BooleanField(default=False)
    name = models.CharField(max_length=20)
    description = models.TextField(default="meowsenger group")
    users = models.ManyToManyField(User, through="UserChat", related_name="chats")
    admins = models.ManyToManyField(User, through="AdminChat", related_name="manage")
    is_verified = models.BooleanField(default=False)
    secret = models.CharField(max_length=64, default=secrets.token_hex(16))
    last_time = models.DateTimeField(default=datetime.now)

    def __str__(self):
        return f"Chat('{self.name}')"


class Message(models.Model):
    id = models.BigAutoField(primary_key=True)  # Changed from AutoField to BigAutoField
    text = models.TextField()
    is_deleted = models.BooleanField(default=False)
    is_edited = models.BooleanField(default=False)
    is_system = models.BooleanField(default=False)
    send_time = models.DateTimeField(default=datetime.now)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="messages")
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name="messages")
    reply_to = models.BigIntegerField(
        null=True, blank=True
    )  # Changed from IntegerField to BigIntegerField
    is_forwarded = models.BooleanField(default=False)
    unread_by = models.ManyToManyField(
        User, through="UserMessage", related_name="unread"
    )

    def __str__(self):
        return f"Message('{self.id}', '{self.text[:20]}')"


class Update(models.Model):
    id = models.BigAutoField(primary_key=True)  # Changed from AutoField to BigAutoField
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name="updates")
    message = models.ForeignKey(
        Message, on_delete=models.CASCADE, related_name="updates"
    )
    time = models.DateTimeField(default=datetime.now)

    def __str__(self):
        return f"Update('{self.chat.name}', '{self.message.id}')"


class Notify(models.Model):
    id = models.BigAutoField(primary_key=True)  # Changed from AutoField to BigAutoField
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifies")
    subscription = models.TextField()

    def __str__(self):
        return f"Notify('{self.user.username}')"


# Association tables for many-to-many relationships
class UserChat(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE)

    class Meta:
        db_table = "user_chat"
        unique_together = ("user", "chat")


class AdminChat(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE)

    class Meta:
        db_table = "admin_chat"
        unique_together = ("user", "chat")


class UserMessage(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, db_column="msg_id")

    class Meta:
        db_table = "user_message"
        unique_together = ("user", "message")
