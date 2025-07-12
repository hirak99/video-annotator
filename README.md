# Running

## Setup

After cloning, install the necessary packages.

```sh
# Install necessary python modules.
pip install flask flask_cors flask_socketio gunicorn

# One time install of node modules.
(cd client && npm install)
```

## Configuring

```sh
cp configuration_example.json configuration.json

# Edit to point to your movies and specify your label names.
vim configuration.json
```

# Run the server the client.

```sh
# Start the server.
ANNOTATION_CONFIG_FILE=configuration.json ./dev_server.sh
```

```sh
# Start the client.
./dev_client.sh
```

Or you can choose to run the prod versions. See documentation in the prod*.sh scripts.

# Features

- Server / client interface
- Configuration to specify label types and video files to label
- Basic security so that anyone with just the URL cannot access your videos
- Automatic saving
- Realtime propagation of edits across all open clients
- On the fly MKV to MP4 conversion
- Error checking and hints on the client (for overlapping labels)
