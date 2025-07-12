import argparse
import functools
import json
import logging
import os
import subprocess
import typing
from typing import TypedDict

import flask
from flask import jsonify
from flask import request
import flask_cors
import yaml

# Convert mkv to mp4 here.
_TEMP_DIR = "_temp_movie_cache"


class _User(TypedDict):
    username: str
    password: str


class _LabelProperties(TypedDict):
    name: str
    allow_overlap: bool


class _VideoFile(TypedDict):
    video_file: str
    label_file: str


class _Label(TypedDict):
    id: str
    name: str
    start: float
    end: float
    x: float
    y: float
    width: float
    height: float


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
        response.headers["Content-Length"] = str(content_length)
        return response

    # If no range is provided, send the whole video
    with open(video_path, "rb") as video_file:
        data = video_file.read()

    return flask.Response(data, mimetype="video/mp4")


def _login_required(f):
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if "username" not in flask.session:  # Check if the user is logged in
            return {"needs_login": True}
            return flask.redirect(
                flask.url_for("login")
            )  # Redirect to login page if not logged in
        return f(*args, **kwargs)

    return decorated_function


def add_common_endpoints(
    app: flask.Flask, video_files: list[_VideoFile], label_types: list[_LabelProperties]
):
    # Simple function to get labels from a JSON file
    def _load_labels(video_id: int) -> list[_Label]:
        labels_file = video_files[video_id]["label_file"]
        if os.path.exists(labels_file):
            with open(labels_file, "r") as f:
                return json.load(f)
        return []

    # Simple function to save labels to a JSON file
    def _save_labels(video_id: int, labels: list[_Label]):
        labels.sort(key=lambda x: (x["name"], x["start"]))
        labels_file = video_files[video_id]["label_file"]
        with open(labels_file, "w") as f:
            json.dump(labels, f)

    @app.route("/api/labels/<int:video_id>", methods=["GET"])
    @_login_required
    def get_labels(video_id):
        return jsonify(_load_labels(video_id))

    @app.route("/api/add-label/<int:video_id>", methods=["POST"])
    @_login_required
    def add_label(video_id: int):
        new_label: _Label = typing.cast(_Label, request.json)
        labels = _load_labels(video_id)
        labels.append(new_label)
        _save_labels(video_id, labels)
        return jsonify({"status": "success", "label": new_label}), 201

    @app.route("/api/update-label/<int:video_id>/<string:label_id>", methods=["PUT"])
    @_login_required
    def update_label(video_id: int, label_id: str):
        updated_label_data = typing.cast(_Label, request.json)
        labels = _load_labels(video_id)
        for idx, label in enumerate(labels):
            if label["id"] == label_id:
                # Update the existing label with the new data, keeping the original ID
                label.update(updated_label_data)
                label["id"] = (
                    label_id  # Ensure ID is not changed if updated_label_data contains it
                )
                labels[idx] = label  # Assign the updated label back to the list
                _save_labels(video_id, labels)
                return jsonify({"status": "success", "label": labels[idx]})
        # If the label_id is not found
        return (
            jsonify(
                {"status": "error", "message": f"Label with id {label_id} not found"}
            ),
            404,
        )

    @app.route("/api/delete-label/<int:video_id>/<string:label_id>", methods=["DELETE"])
    @_login_required
    def delete_label(video_id, label_id):
        labels = _load_labels(video_id)
        initial_count = len(labels)
        labels = [label for label in labels if label["id"] != label_id]
        if len(labels) < initial_count:
            _save_labels(video_id, labels)
            return jsonify(
                {"status": "success", "message": f"Label with id {label_id} deleted"}
            )
        else:
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": f"Label with id {label_id} not found",
                    }
                ),
                404,
            )

    @app.route("/api/video-files", methods=["GET"])
    @_login_required
    def get_video_files():
        # Return video files without the path.
        without_path: list[_VideoFile] = []
        for video in video_files:
            without_path.append(video.copy())
            without_path[-1]["video_file"] = os.path.basename(video["video_file"])
        return jsonify(without_path)

    @app.route("/api/label-types", methods=["GET"])
    def get_label_types():
        return jsonify(label_types)


class MainApp:
    def __init__(self, config_file: str):
        self.app: flask.Flask = flask.Flask(__name__)
        # Enable CORS for frontend to communicate with the backend.
        flask_cors.CORS(self.app, supports_credentials=True)
        # Add a secret key which is mandatory for using flask.session for session management.
        self.app.secret_key = "vO2hlWdvaKzL0smYUCrQtGgggzxA7paw"

        # Load video files from YAML.
        with open(config_file, "r") as f:
            config = yaml.safe_load(f)

        label_types: list[_LabelProperties] = config["labels"]
        video_files: list[_VideoFile] = config["videos"]

        add_common_endpoints(self.app, video_files=video_files, label_types=label_types)

        self._repacked_original_fname: str = ""
        self._repacked_fname: str = ""

        @self.app.route("/api/video/<int:video_id>", methods=["GET"])
        @_login_required
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

        # @self.app.before_request
        # def clear_login_on_reload():
        #     flask.session.clear()

        @self.app.route("/logout", methods=["POST"])
        def logout():
            flask.session.clear()
            logging.info("Logged out.")
            return jsonify({"status": "success"})

        @self.app.route("/login", methods=["POST"])
        def login():
            username = request.json.get("username")  # type: ignore
            password = request.json.get("password")  # type: ignore
            users: list[_User] = config["users"]
            logging.info(flask.session)
            flask.session.clear()
            for user in users:
                if user["username"] == username and user["password"] == password:
                    flask.session["username"] = username
                    logging.info(flask.session)
                    return jsonify({"status": "success"})
            else:
                return (
                    jsonify({"status": "error", "message": "Invalid credentials"}),
                    401,
                )

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
        default="configuration_example.yaml",
        help="Path to the configuration YAML file.",
    )
    args = parser.parse_args()

    main_app = MainApp(config_file=args.config)
    port = int(os.getenv("PORT", 8080))
    main_app.app.run(debug=True, host="0.0.0.0", port=port)
