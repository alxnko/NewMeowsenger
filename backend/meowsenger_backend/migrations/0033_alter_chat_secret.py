# Generated by Django 5.2 on 2025-04-14 11:42

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0032_alter_chat_secret'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chat',
            name='secret',
            field=models.CharField(default='d76de7a8be9d549ec71e01ff71aa8a1e', max_length=64),
        ),
    ]
