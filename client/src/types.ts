export interface BoxLabel {
  annotation_type: "Box";
  start: number;
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnnotationProps {
  creator: string;
  id: string;
  name: string;
  label: BoxLabel;
}

export interface LabelType {
    name: string;
    allow_overlap: boolean;
    color?: string;
}
