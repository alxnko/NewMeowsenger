# Generated by Django 5.2 on 2025-05-22 07:58

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0119_alter_chat_secret'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chat',
            name='secret',
            field=models.CharField(default='f869a3e28a39114d49c25056eb578bae', max_length=64),
        ),
    ]
