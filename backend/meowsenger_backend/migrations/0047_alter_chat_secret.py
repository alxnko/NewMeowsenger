# Generated by Django 5.2 on 2025-04-29 10:21

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0046_alter_chat_secret'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chat',
            name='secret',
            field=models.CharField(default='24a8945d56b80e9110cef1678e14982a', max_length=64),
        ),
    ]
