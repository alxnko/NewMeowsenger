# Generated by Django 5.2 on 2025-05-17 13:21

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0095_alter_chat_secret'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chat',
            name='secret',
            field=models.CharField(default='f05ca9f79f32629a6be0c111e9896974', max_length=64),
        ),
    ]
