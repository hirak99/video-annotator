# Manual Video Annotation Tool

Demo video -

[![Demo Video](https://img.youtube.com/vi/cIWa4ik96no/0.jpg)](https://youtu.be/cIWa4ik96no)

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
- **Basic security** to restrict video access to users who have the correct password. However, this is not intended for high-security environments.
- **Real time error hints** to help the user know and correct errors in labeling as they occur. For example, if a label that should be unique is seen to be in two places simultaneously in any frame.
- **Keyboard shortcuts** for precise alignment and resizing, with contextual tooltips.
- **Precise media seek controls** for aligning the annotations in time.
- **Several ways to track the label on the video against the sidebar** including clicking and selecting, a matching number shown in both, dimming of videos not shown, and seek on click if a label is not currently visible.
- **Visual feedback** when it is saving (top left) or skipping the video via seek buttons (overlay on the video).
- **Backend calls are consolidated** for keyboard edits to save making numerous calls in short succession if user presses and holds down a key.
- **Safety mechanism for edits** disables editing by default on load, easily disengaged on clicking the button to start editing.
- **Finalized files** by `chmod a-w` on the label json in server are recognized and exposed in view-only mode.
- **Thumbnail preview** upon scrubbing the video seek bar.

### What it does not do

Following are a list of things that this does not do.

The main reason it does not do them is that I did not need them yet. It is possible to implement these in the future.

- No support for keyframe or moving rectangles.
- No support for segmentation or arbitrary polygonal region-of-interests.
- Video file names must be different (even if they are within different directories).

## Background

For a [Video Understanding](https://github.com/hirak99/video-summarizer) project, we needed to annotate a large number of videos with rectangular regions of interest (ROIs).

This is a common task for machine learning pipelines and applications.

However, the publicly available tools were either too limited in scope or not very easy to configure and use. As a result, I decided to quickly implement a tool that better fitted our needs.

# Running

## Setup

After cloning, install the necessary packages. You may optionally install and run the Python packages on a Python virtual environment.

```sh
# General movie and image tools.
sudo apt install ffmpeg imagemagick

# Install necessary python modules.
pip install flask flask_cors flask_socketio gunicorn pydantic

# One time install of node modules.
(cd client && npm install)
```

## Configuring

Configure [configuration_example.yaml](./configuration_example.yaml).

You can override the config file location, in order of precedence, with -
1. the "-c" option to specify it, or
2. the "ANNOTATION_CONFIG_FILE" environment variable.

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

# Acknowledgements

Special thanks to [Nina Shih](https://github.com/nasocializes) for valuable contributions during early development and beyond.

# Support

I'm happy to support the community and help you with any issues you encounter. Here are a few ways to get support:

- GitHub Issues: For general questions, bug reports, or feature requests, please use the [Issues tab on GitHub](https://github.com/hirak99/video-annotator/issues). I monitor this and will try to respond.
- Documentation: Before reaching out, please check the documentation for common questions and setup guides. You might find the solution you're looking for!

If you need more in-depth or urgent assistance, feel free to reach out, and I'll let you know how we can proceed.
