# Generated by Django 5.2 on 2025-05-13 06:13

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0073_alter_chat_secret'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chat',
            name='secret',
            field=models.CharField(default='c6be0b4f5b41676641bc368427e3a38c', max_length=64),
        ),
    ]
