# Generated by Django 5.2 on 2025-04-10 09:27

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0005_alter_chat_secret'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chat',
            name='secret',
            field=models.CharField(default='7e49ebe6b8e564fa3b206a97c754368a', max_length=64),
        ),
    ]
