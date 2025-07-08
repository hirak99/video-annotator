#!/bin/bash

set -uexo pipefail

export PORT=5060

cd client/
npm start build
serve -s build
