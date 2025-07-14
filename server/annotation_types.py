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
    # User who created this label.
    creator: str

    # Following comes from the UI.
    id: str
    name: str
    label: BoxLabel
