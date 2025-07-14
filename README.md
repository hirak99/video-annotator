# Manual Video Annotation Tool

Demo video -

[![Demo Video](https://img.youtube.com/vi/r6EBCOaYuEo/0.jpg)](https://youtu.be/r6EBCOaYuEo)

## Features

- Web based (React + Python backend)
- Server / client interface, so the UI can be exposed over Internet or local network if needed
- [Configuration](./configuration_example.yaml) to specify label types and video files
- Basic security so that anyone with just the URL cannot access your videos

### Quality-of-Life Features

There are innumerous small details which help with usability. Following is a list of a few of them.

- Automatic saving - to stop work loss.
- Realtime propagation of edits across all open clients - to ensure work is not lost of two people happen to look at the same video via the exposed WebUI.
- On the fly MKV to MP4 conversion - changing the container increases compatibility with streaming. However, full transcoding is not yet supported.
- Error checking and hints on the client - helpful message is shown on errors. For example, if a label that should be unique is seen to be in two places simultaneously in any frame.
- Key combinations - for precise editing of regions.
- Seek buttons - for precise seeking of the video.

### What it does not do

- No support for keyframe or moving rectangles.
- No support for segmentation or arbitrary polygonal region-of-interests.

## Why another one?

In a project that I am working on, I needed annotations, for lattice-aligned mostly static rectanglular region-of-interests.

This is a niche area. There are not many tools available, but there are indeed a few notable ones that already exist.

However, I found them to be too powerful and complex for what I needed. I felt the need for a simple, easy to set up tool, that does what I need - and is fun to use. It took about a week to put the initial version together.

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

Configure [configuration_example.json](./configuration_example.yaml).

You may also create a new configuration file, and pass it using the `ANNOTATION_CONFIG_FILE` environment variable.

# Running

Start the server.
```sh
./dev_server.sh
```

While keeping it open, also start the client.
```sh
# Start the client.
./dev_client.sh
```

For production environment, it is recommended to use `./prod_server.sh` and `./prod_client.sh` instead. See documentations in the scripts.

# Support

I'm happy to support the community and help you with any issues you encounter. Here are a few ways to get support:

- GitHub Issues: For general questions, bug reports, or feature requests, please use the Issues tab on GitHub. I monitor this and will try to respond.
- Documentation: Before reaching out, please check the documentation for common questions and setup guides. You might find the solution you're looking for!

If you need more in-depth or urgent assistance, feel free to reach out, and I'll let you know how we can proceed.
