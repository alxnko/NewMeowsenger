#!/usr/bin/env python
"""
Development script to run Django commands with the correct local settings.
This ensures that the correct database connection is used when running locally.

Usage:
    python dev.py runserver
    python dev.py makemigrations
    python dev.py migrate
    etc.
"""

import os
import sys
import django
from pathlib import Path

# Set environment variable to use local database
os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "meowsenger_backend.settings")


def main():
    """Run administrative tasks."""
    django.setup()
    # Import inside function to avoid errors before django.setup()
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
