export interface BoxLabel {
  annotation_type: "Box";
  start: number;
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// TODO: Change this to Annotation later.
export interface Box {
  creator: string;
  id: string;
  name: string;
  annotation: BoxLabel;
}

export interface LabelType {
    name: string;
    allow_overlap: boolean;
}
