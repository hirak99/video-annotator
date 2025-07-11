import argparse
import json
import logging
import os
import subprocess
from typing import TypedDict

import flask
from flask import jsonify
from flask import request
import flask_cors
import yaml

# Convert mkv to mp4 here.
_TEMP_DIR = "_temp_movie_cache"


class _LabelProperties(TypedDict):
    name: str
    allow_overlap: bool


class _VideoFile(TypedDict):
    video_file: str
    label_file: str


# Unused functions for flask endpoints.
# pyright: reportUnusedFunction=false


def _repack_to_mp4(mkv_file: str) -> str:
    temp_mp4 = os.path.join(_TEMP_DIR, os.path.basename(mkv_file) + ".mp4")
    if not os.path.exists(temp_mp4):  # Avoid repacking if already done
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                mkv_file,
                "-c",
                "copy",
                "-movflags",
                "+faststart",
                temp_mp4,
            ]
        )
    return temp_mp4


def _stream_video(video_path: str, request: flask.Request):
    video_file = os.path.getsize(video_path)

    # Get the range from the request headers (e.g., "bytes=0-1023")
    range_header = request.headers.get("Range", None)

    if range_header:
        # Parse the Range header
        byte1, byte2 = range_header.strip().replace("bytes=", "").split("-")
        byte1 = int(byte1)
        byte2 = byte2 and int(byte2) or video_file - 1

        # Set the content range and content length headers for partial content
        content_range = f"bytes {byte1}-{byte2}/{video_file}"
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


def add_common_endpoints(
    app: flask.Flask, video_files: list[_VideoFile], label_types: list[_LabelProperties]
):
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

    @app.route("/api/delete-label/<int:video_id>/<string:box_id>", methods=["DELETE"])
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

    @app.route("/api/video-files", methods=["GET"])
    def get_video_files():
        return jsonify(video_files)

    @app.route("/api/label-types", methods=["GET"])
    def get_label_types():
        return jsonify(label_types)


class MainApp:
    def __init__(self, config_file: str):
        self.app: flask.Flask = flask.Flask(__name__)
        # Enable CORS for frontend to communicate with the backend.
        flask_cors.CORS(self.app)

        # Load video files from YAML.
        with open(config_file, "r") as f:
            config = yaml.safe_load(f)

        label_types: list[_LabelProperties] = config["labels"]
        video_files: list[_VideoFile] = config["videos"]

        add_common_endpoints(self.app, video_files=video_files, label_types=label_types)

        self._repacked_original_fname: str = ""
        self._repacked_fname: str = ""

        @self.app.route("/api/video/<int:video_id>", methods=["GET"])
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
            video_file = video["video_file"]
            return _stream_video(self._repack_video(video_file), request=request)

    def _repack_video(self, video_file: str) -> str:
        if video_file.endswith(".mp4"):
            return video_file

        if not os.path.exists(_TEMP_DIR):
            os.makedirs(_TEMP_DIR)
        if video_file != self._repacked_original_fname:
            self._repacked_fname = _repack_to_mp4(video_file)
            self._repacked_original_fname = video_file
        return self._repacked_fname

    def __del__(self):
        """Remove temporary files after request."""
        for file_name in os.listdir(_TEMP_DIR):
            file_path = os.path.join(_TEMP_DIR, file_name)
            if os.path.isfile(file_path):
                os.remove(file_path)
                logging.info(f"Deleted temporary file: {file_path}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    parser = argparse.ArgumentParser(description="Video Labeling Server")
    parser.add_argument(
        "-c",
        "--config",
        default="configuration.yaml",
        help="Path to the configuration YAML file.",
    )
    args = parser.parse_args()

    main_app = MainApp(config_file=args.config)
    port = int(os.getenv("PORT", 8080))
    main_app.app.run(debug=True, host="0.0.0.0", port=port)
