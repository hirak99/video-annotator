import logging
import os
import threading
import time

import flask
from flask import jsonify
from flask import request
import flask_cors
import flask_socketio

from . import common_types
from . import config_manager
from . import data_endpoints
from . import streaming_endpoints

# Unused functions for flask endpoints.
# pyright: reportUnusedFunction=false

_CONFIG_RESCAN_PERIOD = 60


class _ConfigRescanner:
    """Periodically rescan config, by just loading it.

    This will ensure any new videos are processed for thumbnails, etc., without having
    to wait for a user query.
    """

    def __init__(self) -> None:
        self._stop = False
        self._thread = threading.Thread(target=self.run, daemon=True)
        self._thread.start()

    def run(self):
        last_rescan = 0
        while not self._stop:
            if time.time() - last_rescan > _CONFIG_RESCAN_PERIOD:
                last_rescan = time.time()
                logging.info("Rescanning config.")
                config_manager.reload_config()
            time.sleep(1)


class MainApp:
    def __init__(self):
        self.app: flask.Flask = flask.Flask(__name__)
        # Enable CORS for frontend to communicate with the backend.
        flask_cors.CORS(self.app, supports_credentials=True)
        # Add a secret key which is mandatory for using flask.session for session management.
        self.app.secret_key = "vO2hlWdvaKzL0smYUCrQtGgggzxA7paw"
        self.socketio = flask_socketio.SocketIO(self.app, cors_allowed_origins="*")

        self._rescanner = _ConfigRescanner()

        @self.app.route("/logout", methods=["POST"])
        def logout():
            flask.session.clear()
            logging.info("Logged out.")
            return jsonify({"status": "success"})

        @self.app.route("/login", methods=["POST"])
        @config_manager.with_config
        def login(config: config_manager.Config):
            username = request.json.get("username")  # type: ignore
            password = request.json.get("password")  # type: ignore
            users: list[common_types.User] = config.get_users()
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

        # Label getting and setting, list videos.
        data_endpoints.add_common_endpoints(
            self.app,
            socketio=self.socketio,
        )

        # Video streaming.
        streaming_endpoints.VideoStreamer().add_video_endpoints(
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
