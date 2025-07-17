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
import flask_socketio
import pydantic
import yaml

from . import annotation_types
from . import preprocess_movies

_CONFIG_FILE = os.getenv("ANNOTATION_CONFIG_FILE", "configuration_example.yaml")

# Convert mkv to mp4 here.
_TEMP_DIR = "_temp_cache"


class _User(TypedDict):
    username: str
    password: str


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
    app: flask.Flask,
    video_files: list[_VideoFile],
    label_types: list[_LabelProperties],
    socketio: flask_socketio.SocketIO,
):
    # Simple function to get labels from a JSON file
    def _load_labels(video_id: int) -> list[annotation_types.AnnotationProps]:
        labels_file = video_files[video_id]["label_file"]
        if os.path.exists(labels_file):
            with open(labels_file, "r") as f:
                return [
                    annotation_types.AnnotationProps.model_validate(obj)
                    for obj in json.load(f)
                ]
        return []

    # Simple function to save labels to a JSON file
    def _save_labels(
        video_id: int, labels: list[annotation_types.AnnotationProps], client_id: str
    ):
        labels_file = video_files[video_id]["label_file"]
        with open(labels_file, "w") as f:

            def dump_label(label):
                d = label.model_dump()
                if hasattr(label, "label") and isinstance(
                    label.label, annotation_types.BoxLabel
                ):
                    d["label"] = label.label.model_dump_rounded()
                return d

            json.dump([dump_label(label) for label in labels], f)
        # Emit a SocketIO event to notify all clients, including the client_id if provided
        try:
            payload = {"video_id": video_id, "client_id": client_id}
            socketio.emit("labels_updated", payload)
        except Exception as e:
            logging.warning("SocketIO emit failed:", e)

    @app.route("/api/labels/<int:video_id>", methods=["GET"])
    @_login_required
    def get_labels(video_id):
        labels = _load_labels(video_id)
        return jsonify([label.model_dump() for label in labels])

    @app.route("/api/video-files", methods=["GET"])
    @_login_required
    def get_video_files():
        # Return video files without the path.
        file_desc: list[_VideoFile] = []
        for video_id, video in enumerate(video_files):
            file_desc.append(video.copy())
            file_desc[-1]["video_file"] = os.path.basename(video["video_file"])
            try:
                label_count = len(_load_labels(video_id))
                if label_count > 0:
                    file_desc[-1][
                        "video_file"
                    ] += f" ({label_count} label{'s' if label_count > 1 else ''} at last refresh)"
            except pydantic.ValidationError:
                file_desc[-1]["video_file"] += " (error loading labels)"
        return jsonify(file_desc)

    @app.route("/api/label-types", methods=["GET"])
    def get_label_types():
        return jsonify(label_types)

    @app.route("/api/current-user", methods=["GET"])
    @_login_required
    def get_current_user():
        username = flask.session.get("username")
        if username:
            return jsonify({"username": username})
        else:
            return jsonify({"error": "Not logged in"}), 401

    @app.route("/api/set-labels/<int:video_id>", methods=["POST"])
    @_login_required
    def set_labels(video_id: int):
        # Expect request.json to be a dict with keys: "labels" (list) and "client_id" (str)
        data = request.json
        labels_data = data.get("labels", [])  # type: ignore
        client_id = data.get("client_id", "")  # type: ignore
        labels = [
            annotation_types.AnnotationProps.model_validate(label)
            for label in typing.cast(list[dict[str, str]], labels_data)
        ]

        _save_labels(video_id, labels, client_id=client_id)
        return jsonify(
            {"status": "success", "labels": [label.model_dump() for label in labels]}
        )


class MainApp:
    def __init__(self):
        self.app: flask.Flask = flask.Flask(__name__)
        # Enable CORS for frontend to communicate with the backend.
        flask_cors.CORS(self.app, supports_credentials=True)
        # Add a secret key which is mandatory for using flask.session for session management.
        self.app.secret_key = "vO2hlWdvaKzL0smYUCrQtGgggzxA7paw"
        self.socketio = flask_socketio.SocketIO(self.app, cors_allowed_origins="*")

        # Load video files from YAML.
        with open(_CONFIG_FILE, "r") as f:
            config = yaml.safe_load(f)

        label_types: list[_LabelProperties] = config["labels"]
        video_files: list[_VideoFile] = config["videos"]

        # Preprocess thumbnails etc.
        processed_movie_data: list[preprocess_movies.ProcessedMovie] = []
        for index, video_file in enumerate(video_files):
            processed_movie_data.append(
                preprocess_movies.ProcessedMovie(video_file["video_file"])
            )

        add_common_endpoints(
            self.app,
            video_files=video_files,
            label_types=label_types,
            socketio=self.socketio,
        )

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
    main_app = MainApp()
    port = int(os.getenv("PORT", 8080))
    main_app.socketio.run(main_app.app, debug=True, host="0.0.0.0", port=port)
