# Generated by Django 5.2 on 2025-04-10 09:23

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0004_alter_chat_secret'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chat',
            name='secret',
            field=models.CharField(default='9415df00d76fac1c2436e9c5044fe775', max_length=64),
        ),
    ]
