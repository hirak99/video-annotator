import logging
import os
import random
import shutil
import string
import subprocess
import json


def _get_video_duration_sec(fname: str) -> float:
    """Returns the duration of the video in seconds using ffprobe."""
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            fname,
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    info = json.loads(result.stdout)
    logging.info(f"ffprobe info: {info}")
    return float(info["format"]["duration"])


_PROCESSED_ROOT = "./_persistent_cache"

_THUMBNAIL_SPRITE_FNAME = "thumbnail_sprite.jpg"

# If you change these, reflect it in the ThumbnailPreviews.tsx.
# Also delete the persistent cache to rebuild.
_THUMBNAIL_WIDTH = 160
_THUMBNAIL_HEIGHT = 90
_SPRITE_COLS = 10

_NUM_THUMBNAILS = 99
_INTERVAL_SECS_KEY = "interval_secs"

# This is for backwards compatibility. Earlier, the _THUMBNAIL_SECS used to be fixed.
# This is the default assumed, for files without info.
_DEFAULT_INTERVAL_SECS = 10


# Creates movie sprites (and may be later process the movie for better streaming as well).
class ProcessedMovie:
    def __init__(self, movie_fname: str):
        self._original_fname: str = movie_fname
        self._processed_dir = os.path.join(
            _PROCESSED_ROOT, os.path.basename(movie_fname)
        )

        if not os.path.exists(self.thumbnail_sprite_fname):
            os.makedirs(self._processed_dir, exist_ok=True)
            self._make_thumb_sprites()

    @property
    def thumbnail_sprite_fname(self) -> str:
        return os.path.join(self._processed_dir, _THUMBNAIL_SPRITE_FNAME)

    @property
    def _thumbnail_info_fname(self) -> str:
        return os.path.join(self._processed_dir, "thumbnail_info.json")

    @property
    def thumbnail_info(self) -> dict[str, int | str]:
        if not os.path.exists(self._thumbnail_info_fname):
            return {_INTERVAL_SECS_KEY: _DEFAULT_INTERVAL_SECS}
        with open(self._thumbnail_info_fname, "r") as f:
            return json.load(f)

    def _make_thumb_sprites(self) -> None:
        # Show an error if the movie file does not exist.
        if not os.path.exists(self._original_fname):
            raise FileNotFoundError(
                f"Movie file {self._original_fname} does not exist."
            )

        # Make a randomly named dir under which thumbnails are stored.
        temp_dir = os.path.join(
            _PROCESSED_ROOT,
            "_temp_" + "".join(random.choices(string.ascii_lowercase, k=10)),
        )
        logging.info(
            f"Creating thumbnails for {self._original_fname} in temporary dir {temp_dir}."
        )
        os.makedirs(temp_dir, exist_ok=True)

        # Determine video duration and optimal interval for 100 thumbnails.
        duration_sec = _get_video_duration_sec(self._original_fname)
        interval_sec = max(duration_sec // _NUM_THUMBNAILS, 1)  # Avoid interval < 1s

        # Make thumbnails.
        subprocess.check_call(
            [
                "ffmpeg",
                "-i",
                self._original_fname,
                "-vf",
                (
                    f"fps=1/{interval_sec},"
                    f"scale={_THUMBNAIL_WIDTH}:{_THUMBNAIL_HEIGHT}:force_original_aspect_ratio=decrease,"
                    f"pad={_THUMBNAIL_WIDTH}:{_THUMBNAIL_HEIGHT}:(ow-iw)/2:(oh-ih)/2"
                ),
                "-vsync",
                "vfr",
                f"{temp_dir}/_temp_thumb_%05d.jpg",
            ]
        )

        # Make a sprite.
        subprocess.check_call(
            [
                "montage",
                f"{temp_dir}/_temp_thumb_*.jpg",
                "-tile",
                f"{_SPRITE_COLS}x",
                "-geometry",
                "+0+0",
                f"{temp_dir}/{_THUMBNAIL_SPRITE_FNAME}",
            ]
        )

        # Write thumbnail_info.json with INTERVAL_SECS_KEY
        info_path = self._thumbnail_info_fname
        with open(info_path, "w") as f:
            json.dump({_INTERVAL_SECS_KEY: interval_sec}, f)

        # Move it to the right location.
        os.rename(
            os.path.join(temp_dir, _THUMBNAIL_SPRITE_FNAME), self.thumbnail_sprite_fname
        )

        # Remove the temporary dir recursively.
        shutil.rmtree(temp_dir)

        logging.info(f"Thumbnails created for {self._original_fname}.")
