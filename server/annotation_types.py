import os
from typing import Literal

import pydantic


class BoxLabel(pydantic.BaseModel):
    # Unique type identifier for Pydantic to load this from JSON.
    annotation_type: Literal["Box"] = "Box"

    start: float
    end: float
    x: float
    y: float
    width: float
    height: float

    def model_dump_rounded(self):
        d = self.model_dump()
        # Drop extra long decimal points.
        d["x"] = round(self.x, 2)
        d["y"] = round(self.y, 2)
        d["width"] = round(self.width, 2)
        d["height"] = round(self.height, 2)
        return d


class AnnotationProps(pydantic.BaseModel):
    # Following comes from the UI.
    id: str
    name: str
    label: BoxLabel


class _AllAnnotationsV1(pydantic.BaseModel):
    by_user: dict[str, list[AnnotationProps]]

    @classmethod
    def load(cls, labels_file: str) -> "_AllAnnotationsV1":
        if os.path.exists(labels_file):
            with open(labels_file, "r") as f:
                return cls.model_validate_json(f.read())
        return cls(by_user={})

    def save(self, labels_file: str):
        with open(labels_file, "w") as f:
            f.write(self.model_dump_json(indent=2))


class UserAnnotation(pydantic.BaseModel):
    annotations: list[AnnotationProps]


class AllAnnotationsV2(pydantic.BaseModel):
    # Annotation data format.
    format: Literal["v2"] = "v2"
    # Annotations by all users.
    by_user: dict[str, UserAnnotation]

    @classmethod
    def _from_v1(cls, v1: _AllAnnotationsV1) -> "AllAnnotationsV2":
        by_user: dict[str, UserAnnotation] = {}
        for user, annotations in v1.by_user.items():
            by_user[user] = UserAnnotation(annotations=annotations)
        return cls(by_user=by_user)

    @classmethod
    def _load_v1(cls, v1_file: str) -> "AllAnnotationsV2":
        v1 = _AllAnnotationsV1.load(v1_file)
        return cls._from_v1(v1)

    def _to_v1(self) -> _AllAnnotationsV1:
        by_user: dict[str, list[AnnotationProps]] = {}
        for user, user_annotations in self.by_user.items():
            by_user[user] = user_annotations.annotations
        return _AllAnnotationsV1(by_user=by_user)

    def _save_v1(self, v1_file: str):
        v1 = self._to_v1()
        v1.save(v1_file)

    @classmethod
    def load(cls, v2_file: str) -> "AllAnnotationsV2":
        # Try to load, if failed, fall back to v1.
        try:
            with open(v2_file, "r") as f:
                return cls.model_validate_json(f.read())
        except pydantic.ValidationError:
            v1 = _AllAnnotationsV1.load(v2_file)
            return cls._from_v1(v1)

    def save(self, v2_file: str):
        with open(v2_file, "w") as f:
            f.write(self.model_dump_json(indent=2))
