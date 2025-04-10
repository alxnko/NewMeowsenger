# Generated by Django 5.2 on 2025-04-10 08:32

import datetime
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('meowsenger_backend', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='user',
            name='avatar',
        ),
        migrations.RemoveField(
            model_name='user',
            name='bio',
        ),
        migrations.AddField(
            model_name='user',
            name='description',
            field=models.CharField(default='default', max_length=20),
        ),
        migrations.AddField(
            model_name='user',
            name='image_file',
            field=models.CharField(default='default', max_length=20),
        ),
        migrations.AddField(
            model_name='user',
            name='is_tester',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='is_verified',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='rank',
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='reg_time',
            field=models.DateTimeField(default=datetime.datetime.now),
        ),
        migrations.CreateModel(
            name='AdminChat',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'admin_chat',
            },
        ),
        migrations.CreateModel(
            name='Chat',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('is_group', models.BooleanField(default=False)),
                ('name', models.CharField(max_length=20)),
                ('description', models.TextField(default='meowsenger group')),
                ('is_verified', models.BooleanField(default=False)),
                ('secret', models.CharField(default='7ca6640752be79b2ae0cca71b50cc7e8', max_length=64)),
                ('last_time', models.DateTimeField(default=datetime.datetime.now)),
                ('admins', models.ManyToManyField(related_name='manage', through='meowsenger_backend.AdminChat', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddField(
            model_name='adminchat',
            name='chat',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='meowsenger_backend.chat'),
        ),
        migrations.CreateModel(
            name='Message',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('text', models.TextField()),
                ('is_deleted', models.BooleanField(default=False)),
                ('is_edited', models.BooleanField(default=False)),
                ('is_system', models.BooleanField(default=False)),
                ('send_time', models.DateTimeField(default=datetime.datetime.now)),
                ('reply_to', models.IntegerField(blank=True, null=True)),
                ('is_forwarded', models.BooleanField(default=False)),
                ('chat', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='messages', to='meowsenger_backend.chat')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='messages', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='Notify',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('subscription', models.TextField()),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifies', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='Update',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('time', models.DateTimeField(default=datetime.datetime.now)),
                ('chat', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='updates', to='meowsenger_backend.chat')),
                ('message', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='updates', to='meowsenger_backend.message')),
            ],
        ),
        migrations.CreateModel(
            name='UserChat',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('chat', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='meowsenger_backend.chat')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'user_chat',
                'unique_together': {('user', 'chat')},
            },
        ),
        migrations.AddField(
            model_name='chat',
            name='users',
            field=models.ManyToManyField(related_name='chats', through='meowsenger_backend.UserChat', to=settings.AUTH_USER_MODEL),
        ),
        migrations.CreateModel(
            name='UserMessage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('message', models.ForeignKey(db_column='msg_id', on_delete=django.db.models.deletion.CASCADE, to='meowsenger_backend.message')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'user_message',
                'unique_together': {('user', 'message')},
            },
        ),
        migrations.AddField(
            model_name='message',
            name='unread_by',
            field=models.ManyToManyField(related_name='unread', through='meowsenger_backend.UserMessage', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterUniqueTogether(
            name='adminchat',
            unique_together={('user', 'chat')},
        ),
    ]
