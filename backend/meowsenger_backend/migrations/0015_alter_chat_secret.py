# Generated by Django 5.2 on 2025-04-13 14:06

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0014_alter_chat_secret'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chat',
            name='secret',
            field=models.CharField(default='bb5362f7706bc68b37a11c95b2b739e1', max_length=64),
        ),
    ]
