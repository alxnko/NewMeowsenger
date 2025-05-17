from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework.validators import UniqueValidator
from .models import Chat, Message, Update, Notify, UserChat, AdminChat, UserMessage

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "description",
            "image_file",
            "rank",
            "is_tester",
            "is_verified",
            "is_staff",
            "reg_time",
            "language",
            "theme",
        )
        read_only_fields = ("reg_time",)


class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        required=False, validators=[UniqueValidator(queryset=User.objects.all())]
    )

    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )

    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = (
            "username",
            "password",
            "password2",
            "email",
            "description",
            "image_file",
            "rank",
            "is_tester",
            "is_verified",
        )

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError(
                {"password": "Password fields didn't match."}
            )
        return attrs

    def create(self, validated_data):
        # Remove password2 as it's not needed for creating the user
        validated_data.pop("password2")

        user = User.objects.create(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            description=validated_data.get("description", "default"),
            image_file=validated_data.get("image_file", "default"),
            rank=validated_data.get("rank", None),
            is_tester=validated_data.get("is_tester", False),
            is_verified=validated_data.get("is_verified", False),
        )

        user.set_password(validated_data["password"])
        user.save()

        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class ChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chat
        fields = "__all__"
        read_only_fields = ("secret", "last_time")


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = "__all__"
        read_only_fields = ("send_time",)


class UpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Update
        fields = "__all__"
        read_only_fields = ("time",)


class NotifySerializer(serializers.ModelSerializer):
    class Meta:
        model = Notify
        fields = "__all__"
