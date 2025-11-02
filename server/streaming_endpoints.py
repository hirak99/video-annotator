import logging
import os
import subprocess

import flask
from flask import jsonify
from flask import request

from . import common
from . import config_manager
from . import preprocess_movies

# Deleted on exit.
_TEMP_DIR = "_temp_cache"


# Unused functions for flask endpoints.
# pyright: reportUnusedFunction=false


def _repack_video(video_file: str) -> str:
    # No need to repack .mp4, they are natively supported on browsers.
    if video_file.endswith(".mp4"):
        return video_file

    os.makedirs(_TEMP_DIR, exist_ok=True)

    temp_mp4 = os.path.join(_TEMP_DIR, os.path.basename(video_file) + ".repacked.mp4")
    if not os.path.exists(temp_mp4):  # Avoid repacking if already done
        logging.info(f"Repacking {video_file} to {temp_mp4}")
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                video_file,
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


class VideoStreamer:

    def add_video_endpoints(
        self,
        app: flask.Flask,
    ):
        # # Preprocess thumbnails etc.
        # processed_movie_data: list[preprocess_movies.ProcessedMovie] = []
        # for video_file in videos_for_current_user():
        #     processed_movie_data.append(
        #         preprocess_movies.ProcessedMovie(video_file["video_file"])
        #     )

        def _thumbnail_data(
            config: config_manager.Config, video_id: int
        ) -> preprocess_movies.ProcessedMovie:
            return preprocess_movies.ProcessedMovie(
                config.get_current_user_videos()[video_id]["video_file"]
            )

        @app.route("/api/video/<int:video_id>", methods=["GET"])
        @common.login_required
        @config_manager.with_config
        def stream_video(config: config_manager.Config, video_id: int):
            video = config.get_current_user_videos()[video_id]
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
            return _stream_video(_repack_video(video_file), request=request)

        @app.route("/api/thumbnail/<int:video_id>/sprite", methods=["GET"])
        @common.login_required
        @config_manager.with_config
        def get_thumbnail_sprite(config: config_manager.Config, video_id: int):
            # Serve the thumbnail sprite binary data with correct MIME type
            sprite_fname = _thumbnail_data(config, video_id).thumbnail_sprite_fname
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

        @app.route("/api/thumbnail/<int:video_id>/info", methods=["GET"])
        @common.login_required
        @config_manager.with_config
        def get_thumbnail_info(config: config_manager.Config, video_id: int):
            return jsonify(_thumbnail_data(config, video_id).thumbnail_info)

    def __del__(self):
        """Remove temporary files after request."""
        if os.path.exists(_TEMP_DIR):
            for file_name in os.listdir(_TEMP_DIR):
                file_path = os.path.join(_TEMP_DIR, file_name)
                if os.path.isfile(file_path):
                    os.remove(file_path)
                    logging.info(f"Deleted temporary file: {file_path}")
