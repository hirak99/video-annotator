import json
import os

import flask
from flask import jsonify
from flask import request
import flask_cors
import yaml

from typing import TypedDict


class _VideoFile(TypedDict):
    video_file: str
    label_file: str


# Unused functions for flask endpoints.
# pyright: reportUnusedFunction=false


def add_common_endpoints(app: flask.Flask, video_files: list[_VideoFile]):
    # Simple function to get labels from a JSON file
    def _load_labels(video_id: int):
        labels_file = video_files[video_id]["label_file"]
        if os.path.exists(labels_file):
            with open(labels_file, "r") as f:
                return json.load(f)
        return []

    # Simple function to save labels to a JSON file
    def _save_labels(video_id: int, labels):
        labels_file = video_files[video_id]["label_file"]
        with open(labels_file, "w") as f:
            json.dump(labels, f)

    @app.route("/api/labels/<int:video_id>", methods=["GET"])
    def get_labels(video_id):
        return jsonify(_load_labels(video_id))

    @app.route("/api/add-label/<int:video_id>", methods=["POST"])
    def add_label(video_id):
        new_label = request.json
        labels = _load_labels(video_id)
        labels.append(new_label)
        _save_labels(video_id, labels)
        return jsonify({"status": "success", "label": new_label}), 201

    @app.route("/api/update-label/<int:video_id>/<string:box_id>", methods=["PUT"])
    def update_label(video_id, box_id):
        updated_label_data = request.json
        labels = _load_labels(video_id)
        for idx, label in enumerate(labels):
            if label["id"] == box_id:
                # Update the existing label with the new data, keeping the original ID
                label.update(updated_label_data)
                label["id"] = (
                    box_id  # Ensure ID is not changed if updated_label_data contains it
                )
                labels[idx] = label  # Assign the updated label back to the list
                _save_labels(video_id, labels)
                return jsonify({"status": "success", "label": labels[idx]})
        # If the box_id is not found
        return (
            jsonify(
                {"status": "error", "message": f"Label with id {box_id} not found"}
            ),
            404,
        )

    @app.route(
        "/api/delete-label/<int:video_id>/<string:box_id>", methods=["DELETE"]
    )
    def delete_label(video_id, box_id):
        labels = _load_labels(video_id)
        initial_count = len(labels)
        labels = [label for label in labels if label["id"] != box_id]
        if len(labels) < initial_count:
            _save_labels(video_id, labels)
            return jsonify(
                {"status": "success", "message": f"Label with id {box_id} deleted"}
            )
        else:
            return (
                jsonify(
                    {"status": "error", "message": f"Label with id {box_id} not found"}
                ),
                404,
            )

    @app.route("/api/video/<int:video_id>", methods=["GET"])
    def stream_video(video_id):
        video = video_files[video_id]
        if not video:
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": f"Video with id {video_id} not found",
                    }
                ),
                404,
            )

        video_path = video["video_file"]
        file_size = os.path.getsize(video_path)

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
            with open(video_path, "rb") as video_file:
                video_file.seek(byte1)
                data = video_file.read(content_length)

            # Return the chunked video data as a 206 Partial Content response
            response = flask.Response(
                data, status=206, mimetype="video/mp4", content_type="video/mp4"
            )
            response.headers["Content-Range"] = content_range
            return response

        # If no range is provided, send the whole video
        with open(video_path, "rb") as video_file:
            data = video_file.read()

        return flask.Response(data, mimetype="video/mp4")

    # Function to get a list of video files with their IDs

    @app.route("/api/video-files", methods=["GET"])
    def get_video_files():
        return jsonify(video_files)


class MainApp:
    def __init__(self):
        self.app: flask.Flask = flask.Flask(__name__)
        # Enable CORS for frontend to communicate with the backend.
        flask_cors.CORS(
            self.app
        )

        # Load video files from YAML.
        with open("video_files.yaml", "r") as f:
            video_files = yaml.safe_load(f)["videos"]

        add_common_endpoints(self.app, video_files=video_files)


if __name__ == "__main__":
    main_app = MainApp()
    main_app.app.run(debug=True, host="0.0.0.0", port=5050)
