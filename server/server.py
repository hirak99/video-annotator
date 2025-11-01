import logging
import os
import subprocess

import flask
from flask import jsonify
from flask import request
import flask_cors
import flask_socketio
import yaml

from . import common
from . import common_types
from . import data_endpoints
from . import preprocess_movies

# Note: Do not use a console argument, unless you also modify gunicorn.py.
_CONFIG_FILE = os.getenv("ANNOTATION_CONFIG_FILE", "configuration_example.yaml")

# Deleted on exit.
_TEMP_DIR = "_temp_cache"


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


class MainApp:
    def __init__(self):
        self.app: flask.Flask = flask.Flask(__name__)
        # Enable CORS for frontend to communicate with the backend.
        flask_cors.CORS(self.app, supports_credentials=True)
        # Add a secret key which is mandatory for using flask.session for session management.
        self.app.secret_key = "vO2hlWdvaKzL0smYUCrQtGgggzxA7paw"
        self.socketio = flask_socketio.SocketIO(self.app, cors_allowed_origins="*")

        # Load video files from YAML.
        logging.info("Loading configuration from " + _CONFIG_FILE)
        with open(_CONFIG_FILE, "r") as f:
            config = yaml.safe_load(f)

        label_types: list[common_types.LabelProperties] = config["labels"]
        video_files: list[common_types.VideoFile] = config["videos"]

        # Preprocess thumbnails etc.
        processed_movie_data: list[preprocess_movies.ProcessedMovie] = []
        for video_file in video_files:
            processed_movie_data.append(
                preprocess_movies.ProcessedMovie(video_file["video_file"])
            )

        data_endpoints.add_common_endpoints(
            self.app,
            video_files=video_files,
            label_types=label_types,
            socketio=self.socketio,
        )

        self._repacked_original_fname: str = ""
        self._repacked_fname: str = ""

        @self.app.route("/api/video/<int:video_id>", methods=["GET"])
        @common.login_required
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

        @self.app.route("/api/thumbnail/<int:video_id>/sprite", methods=["GET"])
        @common.login_required
        def get_thumbnail_sprite(video_id: int):
            # Serve the thumbnail sprite binary data with correct MIME type
            sprite_fname = processed_movie_data[video_id].thumbnail_sprite_fname
            if not os.path.exists(sprite_fname):
                return (
                    jsonify(
                        {
                            "status": "error",
                            "message": f"Thumbnail sprite not found for video {video_id}",
                        }
                    ),
                    404,
                )
            with open(sprite_fname, "rb") as f:
                data = f.read()
            return flask.Response(data, mimetype="image/jpeg")

        @self.app.route("/api/thumbnail/<int:video_id>/info", methods=["GET"])
        @common.login_required
        def get_thumbnail_info(video_id: int):
            logging.info(processed_movie_data[video_id].thumbnail_info)
            return jsonify(processed_movie_data[video_id].thumbnail_info)

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
            users: list[common_types.User] = config["users"]
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

        logging.info("Server is ready.")

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
        if os.path.exists(_TEMP_DIR):
            for file_name in os.listdir(_TEMP_DIR):
                file_path = os.path.join(_TEMP_DIR, file_name)
                if os.path.isfile(file_path):
                    os.remove(file_path)
                    logging.info(f"Deleted temporary file: {file_path}")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    main_app = MainApp()
    port = int(os.getenv("PORT", 8080))
    logging.info("Serving...")
    main_app.socketio.run(
        main_app.app, debug=True, host="0.0.0.0", port=port, allow_unsafe_werkzeug=True
    )
