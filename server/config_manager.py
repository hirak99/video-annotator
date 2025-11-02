import functools
import os
import threading

import yaml

from . import common
from . import common_types
from . import preprocess_movies

# Note: Do not use a console argument, unless you also modify gunicorn.py.
_CONFIG_FILE = os.getenv("ANNOTATION_CONFIG_FILE", "configuration_example.yaml")


class _Config:
    def __init__(self) -> None:
        self._config_lock = threading.Lock()
        self._config: common_types.Config
        with self._config_lock:
            self.reload()

    def reload(self):
        with open(_CONFIG_FILE, "r") as f:
            self._config: common_types.Config = yaml.safe_load(f)
        # Preprocess thumbnails etc.
        for video_file in self.get_video_files():
            preprocess_movies.ProcessedMovie(video_file["video_file"])

    def get_label_types(self) -> list[common_types.LabelProperties]:
        return self._config["labels"]

    def get_video_files(self) -> list[common_types.VideoFileInternal]:
        return self._config["videos"]

    def get_users(self) -> list[common_types.User]:
        return self._config["users"]

    # This must only be called within a flask session.
    def get_current_user_videos(self) -> list[common_types.VideoFileInternal]:
        with self._config_lock:
            return [
                video_file
                for video_file in self.get_video_files()
                if "acl" not in video_file or common.current_user() in video_file["acl"]
            ]


@functools.cache
def instance():
    return _Config()
