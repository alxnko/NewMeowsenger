# Generated by Django 5.2 on 2025-05-13 11:49

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0076_alter_chat_secret'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chat',
            name='secret',
            field=models.CharField(default='35ff48ee9817f8a917972e2eca054e43', max_length=64),
        ),
    ]
