# Generated by Django 5.2 on 2025-05-18 13:18

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0104_alter_chat_secret'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chat',
            name='secret',
            field=models.CharField(default='170254933943ff096e054b90bd2e27b9', max_length=64),
        ),
    ]
