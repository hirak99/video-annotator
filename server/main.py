import json
import os

import flask
from flask import jsonify
from flask import request
import flask_cors

app = flask.Flask(__name__)
flask_cors.CORS(app)  # Enable CORS for frontend to communicate with the backend

VIDEO_PATH = "video.mkv"
LABELS_FILE = "labels.json"


# Simple function to get labels from a JSON file
def _load_labels():
    if os.path.exists(LABELS_FILE):
        with open(LABELS_FILE, "r") as f:
            return json.load(f)
    return []


# Simple function to save labels to a JSON file
def _save_labels(labels):
    with open(LABELS_FILE, "w") as f:
        json.dump(labels, f)


@app.route("/api/labels/<string:model_id>", methods=["GET"])
def get_labels(model_id):
    return jsonify(_load_labels())


@app.route("/api/add-label/<string:model_id>", methods=["POST"])
def add_label(model_id):
    new_label = request.json
    labels = _load_labels()
    labels.append(new_label)
    _save_labels(labels)
    return jsonify({"status": "success", "label": new_label}), 201


@app.route("/api/update-label/<string:model_id>/<string:box_id>", methods=["PUT"])
def update_label(model_id, box_id):
    updated_label_data = request.json
    labels = _load_labels()
    for idx, label in enumerate(labels):
        if label["id"] == box_id:
            # Update the existing label with the new data, keeping the original ID
            label.update(updated_label_data)
            label["id"] = box_id # Ensure ID is not changed if updated_label_data contains it
            labels[idx] = label # Assign the updated label back to the list
            _save_labels(labels)
            return jsonify({"status": "success", "label": labels[idx]})
    # If the box_id is not found
    return jsonify({"status": "error", "message": f"Label with id {box_id} not found"}), 404


@app.route("/api/delete-label/<string:model_id>/<string:box_id>", methods=["DELETE"])
def delete_label(model_id, box_id):
    labels = _load_labels()
    initial_count = len(labels)
    labels = [label for label in labels if label["id"] != box_id]
    if len(labels) < initial_count:
        _save_labels(labels)
        return jsonify({"status": "success", "message": f"Label with id {box_id} deleted"})
    else:
        return jsonify({"status": "error", "message": f"Label with id {box_id} not found"}), 404


@app.route("/api/video/<string:model_id>", methods=["GET"])
def stream_video(model_id):
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


# Function to get a list of video files with their IDs
def _get_video_files():
    return [[1, "video.mkv"]]

@app.route("/api/video-files", methods=["GET"])
def get_video_files():
    return jsonify(_get_video_files())

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5050)
