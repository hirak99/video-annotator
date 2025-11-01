import logging
import os

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
from . import streaming_endpoints

# Note: Do not use a console argument, unless you also modify gunicorn.py.
_CONFIG_FILE = os.getenv("ANNOTATION_CONFIG_FILE", "configuration_example.yaml")

# Unused functions for flask endpoints.
# pyright: reportUnusedFunction=false


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
        video_files: list[common_types.VideoFileInternal] = config["videos"]

        # Preprocess thumbnails etc.
        for video_file in video_files:
            preprocess_movies.ProcessedMovie(video_file["video_file"])

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

        # Filters video files to include only videos visible by the current user.
        # A function, since current_user() is only accessible inside a session.
        def get_current_user_videos() -> list[common_types.VideoFileInternal]:
            return [
                video_file
                for video_file in video_files
                if "acl" not in video_file or common.current_user() in video_file["acl"]
            ]

        # Label getting and setting, list videos.
        data_endpoints.add_common_endpoints(
            self.app,
            current_user_videos_fn=get_current_user_videos,
            label_types=label_types,
            socketio=self.socketio,
        )

        # Video streaming.
        streaming_endpoints.VideoStreamer().add_video_endpoints(
            current_user_videos_fn=get_current_user_videos,
            app=self.app,
        )

        logging.info("Server is ready.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    main_app = MainApp()
    port = int(os.getenv("PORT", 8080))
    logging.info("Serving...")
    main_app.socketio.run(
        main_app.app, debug=True, host="0.0.0.0", port=port, allow_unsafe_werkzeug=True
    )
