# Manual Video Annotation Tool

Demo video -

[![Demo Video](https://img.youtube.com/vi/r6EBCOaYuEo/0.jpg)](https://youtu.be/r6EBCOaYuEo)

## Features

- Server / client interface, so the UI can be exposed over Internet or local network if needed.
- [Configuration](./configuration_example.yaml) to specify label types and video files.

### Quality-of-Life Features

There are numerous small details implemented to make it convenient and easy for the labelers.

Following are a few examples.

- **Automatic saving** to prevent work loss.
- **Supports multiple workers** simultaneously if multiple users log in via different clients.
- **Realtime propagation of edits** across all open clients to ensure work is not lost if two people happen to look at the same video via the exposed WebUI.
- **On the fly MKV to MP4 conversion** to increase browser compatibility. However, full transcoding is not yet supported and must be done as a pre-step if needed.
- **Basic security** to restic video access to users who have the correct password. However, this is not intended for high-security environments.
- **Real time error hints** to help the user know and correct errors in labeling as they occur. For example, if a label that should be unique is seen to be in two places simultaneously in any frame.
- **Keyboard shortcuts** for precise alignment and resizing.
- **Precise media seek controls** for aligning the annotations in time.
- **Several ways to track the label on the video against the sidebar** including clicking and selecting, a matching number shown in both, dimming of videos not shown, and seek on click if a label is not currently visible.
- **Visual feedback** when it is saving (top left) or skipping the video via seek buttons (overlay on the video).
- **Backend calls are consolidated** for keyboard edits to save making numerous calls in short succession if user presses and holds down a key.

### What it does not do

Following are a list of things that this does not do.

The main reason it does not do them is that I did not need them yet. It is possible to implement these in the future.

- No support for keyframe or moving rectangles.
- No support for segmentation or arbitrary polygonal region-of-interests.
- No support for replication, i.e. multiple independent labeling for the same video.

## Why another one?

In a project that I am working on, I needed annotations for lattice-aligned, mostly static rectangular region-of-interests.

This is a niche area. There are not many tools available, but there are indeed a few notable ones that already exist.

However, I found them to be too powerful and complex for what I needed. I felt the need for a simple, easy to set up tool, that does what I need - and is fun to use. It took about a week to put the initial version together.

# Running

## Setup

After cloning, install the necessary packages. You may optionally install and run the Python packages on a Python virtual environment.

```sh
# Install necessary python modules.
pip install flask flask_cors flask_socketio gunicorn pydantic

# One time install of node modules.
(cd client && npm install)
```

## Configuring

Configure [configuration_example.yaml](./configuration_example.yaml).

You may also create a new configuration file, and pass it using the `ANNOTATION_CONFIG_FILE` environment variable.

## Serving

Start the server.
```sh
./dev_server.sh
```

While keeping it open, also start the client.
```sh
# Start the client.
./dev_client.sh
```

For production environment, it is recommended to use `./prod_server.sh` and `./prod_client.sh` instead. See documentation in the scripts.

# Support

I'm happy to support the community and help you with any issues you encounter. Here are a few ways to get support:

- GitHub Issues: For general questions, bug reports, or feature requests, please use the [Issues tab on GitHub](https://github.com/hirak99/video-annotator/issues). I monitor this and will try to respond.
- Documentation: Before reaching out, please check the documentation for common questions and setup guides. You might find the solution you're looking for!

If you need more in-depth or urgent assistance, feel free to reach out, and I'll let you know how we can proceed.
