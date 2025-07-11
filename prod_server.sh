#!/bin/bash

set -uexo pipefail

PORT=8002 python -m server.main "$@"
