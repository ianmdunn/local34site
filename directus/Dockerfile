# Directus with GCS (Google Cloud Storage) support
# Uses official Directus image - GCS driver is built-in
# Pin to a specific version for production (e.g., directus/directus:11.4.1)
FROM directus/directus:11

# Cloud Run expects port 8080
ENV PORT=8080
EXPOSE 8080

# Create directory for GCS key file (mounted at runtime)
# The key file path is configured via STORAGE_GCS_KEY_FILENAME env var
RUN mkdir -p /directus/gcs-credentials

# Optional: if you need custom extensions, uncomment:
# COPY ./extensions /directus/extensions

# CMD is inherited from base image
# Start with: docker compose up or see docker-compose.yml
