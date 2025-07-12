#!/bin/bash

# Usage -
# Config File: Optionally specify with environment variable ANNOTATION_CONFIG_FILE.
# Port: Edit below to replace 8002 with any open port in your system. It must be also used in the prod_client.sh script.

set -uexo pipefail

# The server should usually not timeout; since generation immediately returns a task-id.
# Only time needed may be to load models.
readonly TIMEOUT=$((5 * 60 * 60))

gunicorn \
    --worker-class gthread \
    --workers 1 \
    --threads 128 \
    -b 0.0.0.0:8002 \
    --access-logfile - --error-logfile - \
    --timeout $TIMEOUT \
    --log-level debug \
    'server.gunicorn:app'
