import json
import logging
import os
import typing

import flask
from flask import jsonify
from flask import request
import flask_socketio
import pydantic

from . import annotation_types
from . import common
from . import common_types
from . import config_manager

# Unused functions for flask endpoints.
# pyright: reportUnusedFunction=false


def add_common_endpoints(
    app: flask.Flask,
    socketio: flask_socketio.SocketIO,
):
    def _load_labels_all_users(
        config: config_manager.Config, video_id: int
    ) -> annotation_types.UserAnnotations:
        video_files = config.get_current_user_videos()
        labels_file = video_files[video_id]["label_file"]
        if os.path.exists(labels_file):
            with open(labels_file, "r") as f:
                return annotation_types.UserAnnotations.model_validate_json(f.read())
        return annotation_types.UserAnnotations(by_user={})

    # Simple function to get labels from a JSON file
    def _load_labels(
        config: config_manager.Config, video_id: int
    ) -> list[annotation_types.AnnotationProps]:
        all_users = _load_labels_all_users(config, video_id)
        return all_users.by_user.get(common.current_user(), [])

    # Simple function to save labels to a JSON file
    def _save_labels(
        config: config_manager.Config,
        video_id: int,
        labels: list[annotation_types.AnnotationProps],
        client_id: str,
    ):
        all_users = _load_labels_all_users(config, video_id)

        def dump_label(label):
            d = label.model_dump()
            if hasattr(label, "label") and isinstance(
                label.label, annotation_types.BoxLabel
            ):
                d["label"] = label.label.model_dump_rounded()
            return d

        all_users.by_user[common.current_user()] = [
            annotation_types.AnnotationProps.model_validate(x) for x in labels
        ]

        json.dumps([dump_label(label) for label in labels])

        video_files = config.get_current_user_videos()
        labels_file = video_files[video_id]["label_file"]
        with open(labels_file, "w") as f:
            json.dump(all_users.model_dump(), f, indent=2)

        # Emit a SocketIO event to notify all clients, including the client_id if provided
        try:
            payload = {"video_id": video_id, "client_id": client_id}
            socketio.emit("labels_updated", payload)
        except Exception as e:
            logging.warning("SocketIO emit failed:", e)

    @app.route("/api/labels/<int:video_id>", methods=["GET"])
    @common.login_required
    @config_manager.with_config
    def get_labels(config: config_manager.Config, video_id: int):
        labels = _load_labels(config, video_id)
        return jsonify([label.model_dump() for label in labels])

    @app.route("/api/video-files", methods=["GET"])
    @common.login_required
    @config_manager.with_config
    def get_video_files(config: config_manager.Config):
        video_files = config.get_current_user_videos()
        # Return video files without the path.
        file_desc: list[common_types.VideoFileForProps] = []
        for video_id, video in enumerate(video_files):
            file_desc.append(video.copy())

            if "video_alias" in video:
                file_desc[-1]["video_file"] = video["video_alias"]
            else:
                file_desc[-1]["video_file"] = os.path.basename(video["video_file"])

            # Check if the label_file exists and is readonly.
            readonly = os.path.exists(video["label_file"]) and not os.access(
                video["label_file"], os.W_OK
            )
            file_desc[-1]["readonly"] = readonly

            try:
                label_count = len(_load_labels(config, video_id))
                if label_count > 0:
                    file_desc[-1][
                        "video_file"
                    ] += f" ({label_count} label{'s' if label_count > 1 else ''} at last refresh)"
            except pydantic.ValidationError:
                file_desc[-1]["video_file"] += " (error loading labels)"
        return jsonify(file_desc)

    @app.route("/api/label-types", methods=["GET"])
    @common.login_required
    @config_manager.with_config
    def get_label_types(config: config_manager.Config):
        return jsonify(config.get_label_types())

    @app.route("/api/set-labels/<int:video_id>", methods=["POST"])
    @common.login_required
    @config_manager.with_config
    def set_labels(config: config_manager.Config, video_id: int):
        # Expect request.json to be a dict with keys: "labels" (list) and "client_id" (str)
        data = request.json
        labels_data = data.get("labels", [])  # type: ignore
        client_id = data.get("client_id", "")  # type: ignore
        labels = [
            annotation_types.AnnotationProps.model_validate(label)
            for label in typing.cast(list[dict[str, str]], labels_data)
        ]

        _save_labels(config, video_id, labels, client_id=client_id)
        return jsonify(
            {"status": "success", "labels": [label.model_dump() for label in labels]}
        )
