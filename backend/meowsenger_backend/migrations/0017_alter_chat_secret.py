# Generated by Django 5.2 on 2025-04-13 14:19

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0016_alter_chat_secret'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chat',
            name='secret',
            field=models.CharField(default='89b06a2975f8b05057f24d1c21eca798', max_length=64),
        ),
    ]
