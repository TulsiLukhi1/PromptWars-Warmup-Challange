FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy project
COPY . /app/

# Cloud Run expects the app to listen on the port defined by the PORT environment variable
ENV PORT 8080
EXPOSE $PORT

# Start gunicorn
CMD gunicorn core.wsgi:application --bind 0.0.0.0:$PORT
