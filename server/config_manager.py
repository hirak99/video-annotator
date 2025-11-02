import copy
import functools
import hashlib
import logging
import os
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


class _ConfigDataSingleton:
    """Only one instance of this class should be used."""

    # Singleton.
    def __new__(cls) -> "_ConfigDataSingleton":
        if not hasattr(cls, "_instance"):
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, "_singleton_initialized"):
            return
        self._singleton_initialized = True

        logging.info("New ConfigData")

        self._config: common_types.ConfigType
        self._videos_by_uid: dict[str, common_types.VideoFileInternal] = {}

        self._last_mtime = 0.0
        self._reload()

    def _reload(self):
        # Load only if the file is newer.
        mtime = os.path.getmtime(_CONFIG_FILE)
        if mtime == self._last_mtime:
            return

        with filelock.FileLock(_CONFIG_FILE_LOCK):
            logging.info(f"Reading config from {os.path.abspath(_CONFIG_FILE)!r}")
            with open(_CONFIG_FILE, "r") as f:
                self._config: common_types.ConfigType = yaml.safe_load(f)
            self._last_mtime = mtime

        # Preprocess thumbnails etc.
        self._videos_by_uid = {}
        for video_file in self._config["videos"]:
            video_file["uid"] = hashlib.sha256(
                video_file["video_file"].encode("utf-8")
            ).hexdigest()[:16]
            self._videos_by_uid[video_file["uid"]] = video_file
            preprocess_movies.ProcessedMovie(video_file["video_file"])

    def get(self) -> common_types.ConfigType:
        self._reload()
        return copy.deepcopy(self._config)


# Mechanism to prevent external initialization.
class _PrivateClass:
    pass


class Config:
    def __init__(self, _prevent_external_construction: _PrivateClass) -> None:
        logging.info("New Config")
        self._config = _ConfigDataSingleton().get()

    def get_label_types(self) -> list[common_types.LabelProperties]:
        return self._config["labels"]

    def get_users(self) -> list[common_types.User]:
        return self._config["users"]

    # This must only be called within a flask session.
    def get_current_user_videos(self) -> dict[str, common_types.VideoFileInternal]:
        result: dict[str, common_types.VideoFileInternal] = {}
        for video_file in self._config["videos"]:
            if "acl" in video_file and common.current_user() not in video_file["acl"]:
                continue
            result[video_file["uid"]] = video_file
        return result


def reload_config():
    # Triggers video preprocessing.
    _ = _ConfigDataSingleton().get()


# A decorator that adds config to the kwargs of a function.
# It is guaranteed that the config will not reload while the context is active.
def with_config(f: Callable[..., _R_TYPEVAR]) -> Callable[..., _R_TYPEVAR]:
    @functools.wraps(f)
    def wrapper(*args, **kwargs) -> _R_TYPEVAR:
        return f(*args, **kwargs, config=Config(_PrivateClass()))

    return wrapper
