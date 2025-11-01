from typing import NotRequired, TypedDict


class User(TypedDict):
    username: str
    password: str


class LabelProperties(TypedDict):
    name: str
    allow_multiple: bool
    color: str


class VideoFile(TypedDict):
    # The path to the video to used.
    video_file: str
    # If specified, this alias will be shown instead of file name in the UI.
    video_alias: NotRequired[str]
    # Where the label will be stored.
    label_file: str
    # This need not be declared, will be loaded from the .json file +r attribute.
    readonly: bool
