#!/bin/bash

set -uexo pipefail

cd client/

REACT_APP_BACKEND_URL='http://localhost:5050' PORT=6050 npm start
