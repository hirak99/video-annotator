import React, { useEffect, useState } from 'react';
import SidebarItem from './SidebarItem';
import { AnnotationProps, LabelType } from './types';

interface SidebarProps {
    boxes: AnnotationProps[];
    labelTypes: LabelType[];
    addBox: () => void;
    handleUpdateBox: (updatedBox: AnnotationProps) => void;
    handleDeleteBox: (boxId: string) => void;
    currentTime: number;
    selectedBoxId: string | null;
    setSelectedBoxId: React.Dispatch<React.SetStateAction<string | null>>;
    seekToTime: (time: number) => void;
    setAndUpdateBoxes: (newBoxes: AnnotationProps[]) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    boxes,
    labelTypes,
    addBox,
    handleUpdateBox,
    handleDeleteBox,
    currentTime,
    selectedBoxId,
    setSelectedBoxId,
    seekToTime,
    setAndUpdateBoxes,
}) => {
    const [labelError, setLabelError] = useState<string>("");

    useEffect(() => {
        // Check if box intervals overlap in time with same type of label, for any labelType which should not overlap.
        const overlappingLabels: { [key: string]: { start: number; end: number; id: string }[] } = {};

        for (const box of boxes) {
            const labelType = labelTypes.find(lt => lt.name === box.name);
            if (labelType && !labelType.allow_overlap) {
                if (!overlappingLabels[box.name]) {
                    overlappingLabels[box.name] = [];
                }
                overlappingLabels[box.name].push({ start: box.label.start, end: box.label.end, id: box.id });
            }
        }

        // Store the overlapping label names in an array.
        const overlappingLabelNames: string[] = [];
        for (const labelName in overlappingLabels) {
            const intervals = overlappingLabels[labelName].sort((a, b) => a.start - b.start);
            for (let i = 0; i < intervals.length - 1; i++) {
                if (intervals[i].end > intervals[i + 1].start) {
                    overlappingLabelNames.push(`${labelName} (at ${intervals[i].end})`);
                    break;
                }
            }
        }

        // Generate an error of the form "Following labels do not allow overlap: 'person1', 'person2'. Please remove any overlap in time."
        let error = "";
        if (overlappingLabelNames.length > 0) {
            error = `Overlap not allowed for label types: '${overlappingLabelNames.join("', '")}'. Please edit to remove overlap.`;
        }

        setLabelError(error);
    }, [boxes, labelTypes]);

    return (
        <div
            style={{
                width: '30%', // Sidebar takes 30% width.
                padding: '10px',
                borderLeft: '1px solid #ccc',
                overflowY: 'auto',
                maxHeight: '100vh',
            }}
        >
            <div
                style={{
                    paddingBottom: '10px',
                    borderBottom: '1px solid #eee',
                    marginBottom: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <span>Regions of Interest</span>
                <button onClick={addBox}>Add</button>
            </div>

            {/* Div to show labelError and hidden if error is empty */}
            {labelError && (
                <div style={{ color: 'red', marginBottom: '10px', textAlign: 'center' }}>
                    {labelError}
                </div>
            )}

            {/* List of all the annotations. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0px' }}>
                {/* Flex grid for items */}
                {boxes.map((box, index) => (
                    <SidebarItem
                        index={index}
                        key={box.id}
                        labelTypes={labelTypes}
                        box={box}
                        onUpdateBox={handleUpdateBox}
                        onDeleteBox={handleDeleteBox}
                        currentTime={currentTime}
                        selectedBoxId={selectedBoxId}
                        setSelectedBoxId={setSelectedBoxId}
                        seekToTime={seekToTime}
                    />
                ))}
            </div>

            {/* Sort button */}
            <button
                style={{ margin: '10px 0 0 auto', display: 'block' }}
                onClick={() => {
                    setAndUpdateBoxes(
                        boxes.sort((a, b) => {
                            if (a.label.start === b.label.start) {
                                // Sort by name if they start at same time.
                                if (a.name < b.name) return -1;
                                if (a.name > b.name) return 1;
                            }
                            // In general sort by time.
                            return a.label.start - b.label.start;
                        })
                    );
                }}
            >
                Sort
            </button>
        </div>
    );
};

export default Sidebar;
