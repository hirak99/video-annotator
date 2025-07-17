import React from 'react';
import SidebarItem from './SidebarItem';
import { AnnotationProps, LabelType } from './types';

interface SidebarProps {
  boxes: AnnotationProps[];
  labelTypes: LabelType[];
  labelError: string;
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
  labelError,
  addBox,
  handleUpdateBox,
  handleDeleteBox,
  currentTime,
  selectedBoxId,
  setSelectedBoxId,
  seekToTime,
  setAndUpdateBoxes,
}) => {
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
