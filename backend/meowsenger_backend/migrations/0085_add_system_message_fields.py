# Generated by Django 5.2 on 2025-05-16 15:21

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0084_alter_chat_secret'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chat',
            name='secret',
            field=models.CharField(default='4d2071eaacdb6b6b7957b63949c995b7', max_length=64),
        ),
    ]
