# Manual Video Annotation Tool

Demo video -

[![Demo Video](https://img.youtube.com/vi/r6EBCOaYuEo/0.jpg)](https://youtu.be/r6EBCOaYuEo)

## Features

- Web based (React + Python backend)
- Server / client interface, so the UI can be exposed over Internet or local network if needed
- [Configuration](./configuration_example.yaml) to specify label types and video files
- Basic security so that anyone with just the URL cannot access your videos
- Automatic saving
- Realtime propagation of edits across all open clients
- On the fly MKV to MP4 conversion
- Error checking and hints on the client (for overlapping labels)

### What it does not do

- No support for keyframe or moving rectangles.
- No support for segmentation or arbitrary polygonal region-of-interests.

## Why another one?

The project that I am working on needed annotations for mostly static
lattice-aligned rectanglular region-of-interests, on many videos.

There are a few other video annotation tools available.

But I found them too powerful for what I needed, and/or too complex. This is
simple, does what I need, easy to set up, is fun to use - and it took about a
week to put the initial version together.

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
