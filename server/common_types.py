from typing import NotRequired, TypedDict


class User(TypedDict):
    username: str
    password: str


class LabelProperties(TypedDict):
    name: str
    allow_multiple: bool
    color: str


class VideoFileInternal(TypedDict):
    # The path to the video to used.
    video_file: str
    # If specified, this alias will be shown instead of file name in the UI.
    video_alias: NotRequired[str]
    # Where the label will be stored.
    label_file: str
    # This need not be declared, will be loaded from the .json file +r attribute.
    readonly: bool
    # Users who have access to this video.
    # If not provided, all users will have access.
    acl: NotRequired[list[str]]


class VideoFileForProps(TypedDict):
    """Result of api/video-files for the client."""

    # The name of the video - this can be an alias.
    video_file: str
    # Where the label will be stored.
    label_file: str
    # This need not be declared, will be loaded from the .json file +r attribute.
    readonly: bool
