# Generated by Django 5.2 on 2025-04-12 13:58

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0007_alter_chat_secret'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chat',
            name='secret',
            field=models.CharField(default='c4fc9ab177a40bfccfbb1dd71b1376a5', max_length=64),
        ),
    ]
