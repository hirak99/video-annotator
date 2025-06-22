import json
import os
import subprocess

import flask
from flask import jsonify
from flask import request
import flask_cors

app = flask.Flask(__name__)
flask_cors.CORS(app)  # Enable CORS for frontend to communicate with the backend

VIDEO_PATH = "path_to_your_video.mp4"
LABELS_FILE = "labels.json"


# Simple function to get labels from a JSON file
def load_labels():
    if os.path.exists(LABELS_FILE):
        with open(LABELS_FILE, "r") as f:
            return json.load(f)
    return []


def get_video_chunk(start_time, end_time):
    cmd = [
        "ffmpeg",
        "-ss",
        str(start_time),
        "-to",
        str(end_time),
        "-i",
        VIDEO_PATH,
        "-f",
        "mp4",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "pipe:1",  # Output to stdout (streaming)
    ]
    return subprocess.Popen(cmd, stdout=subprocess.PIPE)


# Simple function to save labels to a JSON file
def save_labels(labels):
    with open(LABELS_FILE, "w") as f:
        json.dump(labels, f)


@app.route("/api/video-url", methods=["GET"])
def get_video_url():
    return jsonify({"url": VIDEO_PATH})


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


@app.route("/api/video-chunk", methods=["GET"])
def stream_video_chunk():
    try:
        start_time = float(
            request.args.get("start", 0)
        )  # Get start time from query params
        end_time = float(request.args.get("end", 10))  # Get end time from query params

        # Get the video chunk from ffmpeg
        video_chunk = get_video_chunk(start_time, end_time)

        # Return the video chunk as a streaming response
        return flask.Response(
            video_chunk, content_type="video/mp4", status=206
        )  # HTTP status 206 for partial content

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
