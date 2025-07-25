import logging
import os
import random
import shutil
import string
import subprocess

_PROCESSED_ROOT = "./_persistent_cache"

_THUMBNAIL_SPRITE_FNAME = "thumbnail_sprite.jpg"

# If you change these, reflect it in the ThumbnailPreviews.tsx.
# Also delete the persistent cache to rebuild.
_THUMBNAIL_WIDTH = 160
_THUMBNAIL_HEIGHT = 90
_SPRITE_COLS = 10
_THUMBNAIL_SECS = 10


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

    def _make_thumb_sprites(self) -> None:
        # Make a randomly named dir under which thumbnails are stored.
        temp_dir = os.path.join(
            _PROCESSED_ROOT,
            "_temp_" + "".join(random.choices(string.ascii_lowercase, k=10)),
        )
        logging.info(
            f"Creating thumbnails for {self._original_fname} in temporary dir {temp_dir}."
        )
        os.makedirs(temp_dir, exist_ok=True)

        # Make thumbnails.
        subprocess.check_call(
            [
                "ffmpeg",
                "-i",
                self._original_fname,
                "-vf",
                (
                    f"fps=1/{_THUMBNAIL_SECS},"
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

        # Move it to the right location.
        os.rename(
            os.path.join(temp_dir, _THUMBNAIL_SPRITE_FNAME), self.thumbnail_sprite_fname
        )

        # Remove the temporary dir recursively.
        shutil.rmtree(temp_dir)

        logging.info(f"Thumbnails created for {self._original_fname}.")
