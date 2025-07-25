#!/bin/bash

# Usage -
# Server Host: The name of the backend server to query.
# Backend Port: Edit if you changed it in prod_server.sh.
# Port: The port where the frontend will serve.

if [[ -z "$SERVER_HOST" ]]; then
  echo "Error: SERVER_HOST should point to your domain without prot. E.g. http://my-server-domain.com"
  exit 1
fi

set -uexo pipefail

cd client/
# Only environment variables prefixed with REACT_APP_ are preserved. They are preserved at compile-time.
REACT_APP_BACKEND_URL="${SERVER_HOST}:8002" npm run build
PORT=8003 serve -s build
