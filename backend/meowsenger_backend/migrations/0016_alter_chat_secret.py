# Generated by Django 5.2 on 2025-04-13 14:09

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0015_alter_chat_secret'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chat',
            name='secret',
            field=models.CharField(default='9103d1c046a38f89e107d390a0258dff', max_length=64),
        ),
    ]
