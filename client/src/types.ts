export interface Box {
    id: string;
    name: string;
    start: number;
    end: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface LabelType {
    name: string;
    allow_overlap: boolean;
}
