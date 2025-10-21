#!/bin/bash

set -uexo pipefail

PORT=5050 python -m server.server "$@"
