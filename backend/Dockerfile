FROM python:3.11-slim AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN pip install --upgrade pip

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /app/wheels -r requirements.txt

# --- Second Stage: Runtime ---
FROM python:3.11-slim AS final
WORKDIR /app

# Copy Python packages from builder stage
COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .

# Install Python packages as root before creating the non-root user
RUN pip install --no-cache-dir /wheels/*

# Create a non-root user and group
RUN groupadd -r appuser && useradd --create-home -r -g appuser appuser

# Copy application code
COPY --chown=appuser:appuser ./meowsenger_backend /app/meowsenger_backend
COPY --chown=appuser:appuser manage.py /app/

# Create entrypoint script to run migrations
RUN echo '#!/bin/bash\n\
echo "Running migrations..."\n\
python manage.py makemigrations\n\
python manage.py migrate\n\
echo "Starting application..."\n\
exec gunicorn --bind :${PORT:-8000} --workers 1 --threads 8 --timeout 0 meowsenger_backend.wsgi:application\n\
' > /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh && \
    chown appuser:appuser /app/entrypoint.sh

USER appuser

# Expose port and run using the entrypoint script
# Cloud Run injects the PORT environment variable
CMD ["/app/entrypoint.sh"]