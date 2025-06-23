import json
import os
import subprocess

import flask
from flask import jsonify
from flask import request
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


def get_video_chunk(start_time, end_time):
    # Use fragmented MP4 for streaming. The 'faststart' flag is not suitable for
    # non-seekable outputs like pipes, as it requires seeking. Fragmented MP4
    # creates self-contained chunks that can be played as they arrive.
    cmd = [
        "ffmpeg",
        "-ss", str(start_time),  # Input seeking, fast
        "-i", VIDEO_PATH,
        "-to", str(end_time),    # Output option, should be after -i
        # Use movflags for fragmented MP4 output, suitable for streaming
        "-movflags", "frag_keyframe+empty_moov",
        "-f", "mp4",
        "-c:v", "libx264",
        "-c:a", "aac",
        "pipe:1",  # Output to stdout
    ]
    # Capture stderr to log potential ffmpeg errors
    return subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


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
        video_process = get_video_chunk(start_time, end_time)

        def generate_chunks():
            try:
                # Read in chunks to avoid loading the whole chunk into memory
                for chunk in iter(lambda: video_process.stdout.read(4096), b""):
                    yield chunk
            finally:
                # Ensure the process is cleaned up
                video_process.stdout.close()
                video_process.wait()
                if video_process.returncode != 0:
                    # Log ffmpeg errors
                    app.logger.error(f"ffmpeg error: {video_process.stderr.read().decode('utf-8')}")

        # Return the video chunk as a streaming response
        return flask.Response(
            generate_chunks(),
            content_type="video/mp4",
            status=200,  # Use 200 OK since we are serving the whole chunk
        )

    except Exception as e:
        app.logger.error(f"Error in stream_video_chunk: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5050)
