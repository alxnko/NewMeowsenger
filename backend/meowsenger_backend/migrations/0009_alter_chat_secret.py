# Generated by Django 5.2 on 2025-04-12 13:59

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0008_alter_chat_secret'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chat',
            name='secret',
            field=models.CharField(default='be53c489b49261eda1bac6995f8e0f7b', max_length=64),
        ),
    ]
