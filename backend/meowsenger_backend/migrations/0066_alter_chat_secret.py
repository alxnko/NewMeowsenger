# Generated by Django 5.2 on 2025-05-01 09:59

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0065_alter_chat_secret'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chat',
            name='secret',
            field=models.CharField(default='50d37d0c6854436e1c27d8b2833bf7a7', max_length=64),
        ),
    ]
