import json
import logging
import os
import subprocess

import flask
from flask import jsonify
from flask import request
from flask import send_file  # Import send_file
import flask_cors

app = flask.Flask(__name__)
flask_cors.CORS(app)  # Enable CORS for frontend to communicate with the backend

VIDEO_PATH = "video.mkv"
LABELS_FILE = "labels.json"


# Simple function to get labels from a JSON file
def load_labels():
    if os.path.exists(LABELS_FILE):
        with open(LABELS_FILE, "r") as f:
            return json.load(f)
    return []


def get_video_duration():
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        VIDEO_PATH,
    ]
    try:
        result = subprocess.run(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, text=True
        )
        return float(result.stdout)
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError) as e:
        app.logger.error(f"Error getting video duration with ffprobe: {e}")
        return None


def get_video_chunk(start_time, end_time):
    # Use fragmented MP4 for streaming. The 'faststart' flag is not suitable for
    # non-seekable outputs like pipes, as it requires seeking. Fragmented MP4
    # creates self-contained chunks that can be played as they arrive.
    cmd = [
        "ffmpeg",
        "-ss",
        str(start_time),  # Input seeking, fast
        "-i",
        VIDEO_PATH,
        "-to",
        str(end_time),  # Output option, should be after -i
        # Use movflags for fragmented MP4 output, suitable for streaming
        "-movflags",
        "frag_keyframe+empty_moov",
        "-f",
        "mp4",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "pipe:1",  # Output to stdout
    ]
    # Capture stderr to log potential ffmpeg errors
    return subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


# Simple function to save labels to a JSON file
def save_labels(labels):
    with open(LABELS_FILE, "w") as f:
        json.dump(labels, f)


@app.route("/api/video-info", methods=["GET"])
def get_video_info():
    duration = get_video_duration()
    logging.info(f"Video duration: {duration}")
    if duration is not None:
        return jsonify({"duration": duration})
    return jsonify({"error": "Could not retrieve video information"}), 500


@app.route("/api/labels", methods=["GET"])
def get_labels():
    return jsonify(load_labels())


@app.route("/api/add-label", methods=["POST"])
def add_label():
    new_label = request.json
    labels = load_labels()
    labels.append(new_label)
    save_labels(labels)
    return jsonify({"status": "success", "label": new_label}), 201


@app.route("/api/update-label", methods=["POST"])
def update_label():
    updated_label = request.json
    labels = load_labels()
    for idx, label in enumerate(labels):
        if label["id"] == updated_label["id"]:
            labels[idx] = updated_label
            break
    save_labels(labels)
    return jsonify({"status": "success", "label": updated_label})


# @app.route("/api/video", methods=["GET"])
# def serve_whole_video():
#     try:
#         response = send_file(VIDEO_PATH, mimetype='video/mp4')
#         return response
#     except FileNotFoundError:
#         return jsonify({"error": "Video file not found"}), 404
#     except Exception as e:
#         app.logger.error(f"Error serving video file: {e}")
#         return jsonify({"error": str(e)}), 500


@app.route("/api/video", methods=["GET"])
def stream_video():
    file_size = os.path.getsize(VIDEO_PATH)

    # Get the range from the request headers (e.g., "bytes=0-1023")
    range_header = request.headers.get("Range", None)

    if range_header:
        # Parse the Range header
        byte1, byte2 = range_header.strip().replace("bytes=", "").split("-")
        byte1 = int(byte1)
        byte2 = byte2 and int(byte2) or file_size - 1

        # Set the content range and content length headers for partial content
        content_range = f"bytes {byte1}-{byte2}/{file_size}"
        content_length = byte2 - byte1 + 1

        # Open the file and read the requested range
        with open(VIDEO_PATH, "rb") as video_file:
            video_file.seek(byte1)
            data = video_file.read(content_length)

        # Return the chunked video data as a 206 Partial Content response
        response = flask.Response(
            data, status=206, mimetype="video/mp4", content_type="video/mp4"
        )
        response.headers["Content-Range"] = content_range
        return response

    # If no range is provided, send the whole video
    with open(VIDEO_PATH, "rb") as video_file:
        data = video_file.read()

    return flask.Response(data, mimetype="video/mp4")


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5050)
