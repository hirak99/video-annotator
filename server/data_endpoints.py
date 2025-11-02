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


def _load_labels_all_users(
    config: config_manager.Config, video_uid: str
) -> annotation_types.AllAnnotationsV2:
    video_files = config.get_current_user_videos()
    labels_file = video_files[video_uid]["label_file"]
    if not os.path.exists(labels_file):
        return annotation_types.AllAnnotationsV2(by_user={})
    return annotation_types.AllAnnotationsV2.load(labels_file)


# Simple function to get labels from a JSON file
def _load_labels(
    config: config_manager.Config, video_uid: str
) -> list[annotation_types.AnnotationProps]:
    all_annotations = _load_labels_all_users(config, video_uid)
    user = common.current_user()
    try:
        return all_annotations.by_user[user].annotations
    except KeyError:
        return []


# Simple function to save labels to a JSON file
def _save_labels(
    config: config_manager.Config,
    video_uid: str,
    labels: list[annotation_types.AnnotationProps],
    client_id: str,
    socketio: flask_socketio.SocketIO,
):
    all_users = _load_labels_all_users(config, video_uid)

    def dump_label(label):
        d = label.model_dump()
        if hasattr(label, "label") and isinstance(
            label.label, annotation_types.BoxLabel
        ):
            d["label"] = label.label.model_dump_rounded()
        return d

    all_users.by_user[common.current_user()].annotations = [
        annotation_types.AnnotationProps.model_validate(x) for x in labels
    ]

    video_files = config.get_current_user_videos()
    labels_file = video_files[video_uid]["label_file"]
    all_users.save(labels_file)

    # Emit a SocketIO event to notify all clients, including the client_id if provided
    try:
        payload = {"video_uid": video_uid, "client_id": client_id}
        socketio.emit("labels_updated", payload)
    except Exception as e:
        logging.warning("SocketIO emit failed:", e)


def add_common_endpoints(
    app: flask.Flask,
    socketio: flask_socketio.SocketIO,
):
    @app.route("/api/labels/<string:video_uid>", methods=["GET"])
    @common.login_required
    @config_manager.with_config
    def get_labels(config: config_manager.Config, video_uid: str):
        labels = _load_labels(config, video_uid)
        return jsonify([label.model_dump() for label in labels])

    @app.route("/api/video-files", methods=["GET"])
    @common.login_required
    @config_manager.with_config
    def get_video_files(config: config_manager.Config):
        video_files = config.get_current_user_videos()
        # Return video files without the path.
        file_desc: list[common_types.VideoFileForProps] = []
        for video_uid, video in video_files.items():
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
                label_count = len(_load_labels(config, video_uid))
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

    @app.route("/api/set-labels/<string:video_uid>", methods=["POST"])
    @common.login_required
    @config_manager.with_config
    def set_labels(config: config_manager.Config, video_uid: str):
        # Expect request.json to be a dict with keys: "labels" (list) and "client_id" (str)
        data = request.json
        labels_data = data.get("labels", [])  # type: ignore
        client_id = data.get("client_id", "")  # type: ignore
        labels = [
            annotation_types.AnnotationProps.model_validate(label)
            for label in typing.cast(list[dict[str, str]], labels_data)
        ]

        _save_labels(config, video_uid, labels, client_id=client_id, socketio=socketio)
        return jsonify(
            {"status": "success", "labels": [label.model_dump() for label in labels]}
        )
