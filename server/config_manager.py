import functools
import logging
import os
import threading
from typing import Callable, TypeVar

import filelock
import yaml

from . import common
from . import common_types
from . import preprocess_movies

_R_TYPEVAR = TypeVar("_R_TYPEVAR")


# Note: Do not use a console argument, unless you also modify gunicorn.py.
_CONFIG_FILE = os.getenv("ANNOTATION_CONFIG_FILE", "configuration_example.yaml")

# Ensure this lock is used while writing to the config when the server is running.
_CONFIG_FILE_LOCK = _CONFIG_FILE + ".lock"


# Mechanism to prevent external initialization.
class _PrivateClass:
    pass


class Config:
    def __init__(self, _prevent_external_construction: _PrivateClass) -> None:
        logging.info("Initializing config ...")
        self._config_lock = threading.Lock()
        self._config: common_types.ConfigType
        with self._config_lock:
            self._reload()

    def _reload(self):
        with filelock.FileLock(_CONFIG_FILE_LOCK):
            with open(_CONFIG_FILE, "r") as f:
                self._config: common_types.ConfigType = yaml.safe_load(f)
        # Preprocess thumbnails etc.
        for video_file in self._config["videos"]:
            preprocess_movies.ProcessedMovie(video_file["video_file"])

    def get_label_types(self) -> list[common_types.LabelProperties]:
        return self._config["labels"]

    def get_users(self) -> list[common_types.User]:
        return self._config["users"]

    # This must only be called within a flask session.
    def get_current_user_videos(self) -> list[common_types.VideoFileInternal]:
        with self._config_lock:
            return [
                video_file
                for video_file in self._config["videos"]
                if "acl" not in video_file or common.current_user() in video_file["acl"]
            ]


def reload_config():
    # Triggers video preprocessing.
    _ = Config(_PrivateClass())


# A decorator that adds config to the kwargs of a function.
# It is guaranteed that the config will not reload while the context is active.
def with_config(f: Callable[..., _R_TYPEVAR]) -> Callable[..., _R_TYPEVAR]:
    @functools.wraps(f)
    def wrapper(*args, **kwargs) -> _R_TYPEVAR:
        return f(*args, **kwargs, config=Config(_PrivateClass()))

    return wrapper
