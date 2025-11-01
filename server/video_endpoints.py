import logging
import os
import subprocess

import flask
from flask import jsonify
from flask import request

from . import common
from . import common_types
from . import preprocess_movies

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


class VideoStreamer:
    def __init__(self, app: flask.Flask):
        self.app = app

    def add_video_endpoints(
        self,
        video_files: list[common_types.VideoFile],
    ):
        # Preprocess thumbnails etc.
        processed_movie_data: list[preprocess_movies.ProcessedMovie] = []
        for video_file in video_files:
            processed_movie_data.append(
                preprocess_movies.ProcessedMovie(video_file["video_file"])
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

    def _repack_video(self, video_file: str) -> str:
        if video_file.endswith(".mp4"):
            return video_file

        if not os.path.exists(_TEMP_DIR):
            os.makedirs(_TEMP_DIR)
        return _repack_to_mp4(video_file)

    def __del__(self):
        """Remove temporary files after request."""
        if os.path.exists(_TEMP_DIR):
            for file_name in os.listdir(_TEMP_DIR):
                file_path = os.path.join(_TEMP_DIR, file_name)
                if os.path.isfile(file_path):
                    os.remove(file_path)
                    logging.info(f"Deleted temporary file: {file_path}")
