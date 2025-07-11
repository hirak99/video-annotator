import React, { useState } from 'react';
import { Box, LabelType } from './types';

const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toFixed(1).padStart(4, '0')}`;
};

interface SidebarItemProps {
    labelTypes: LabelType[];
    box: Box;
    onUpdateBox: (updatedBox: Box) => void;
    onDeleteBox: (boxId: string) => void; // Add onDeleteBox prop
    currentTime: number; // Add currentTime prop
}

const SidebarItem: React.FC<SidebarItemProps> = ({ labelTypes, box, onUpdateBox, onDeleteBox, currentTime }) => {
    const [isEditingName, setIsEditingName] = useState(false);

    const handleNameClick = () => {
        setIsEditingName(true);
    };

    const handleSetStart = () => {
        // If the start is less than end, set newEndTime to start + 1.
        const newEndTime = currentTime >= box.end ? currentTime + 1 : box.end;
        onUpdateBox({ ...box, start: currentTime, end: newEndTime });
    };

    const handleSetEnd = () => {
        onUpdateBox({ ...box, end: currentTime });
    };


    return (
        <div style={{ borderBottom: '1px solid #eee', paddingBottom: '5px', marginBottom: '5px', display: 'grid', gridTemplateColumns: '1fr 90px 10px 90px 30px', gap: '0', alignItems: 'center' }}>
            {/* Box Name */}
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                {isEditingName ? (
                    <select
                        key={box.id}
                        value={box.name}
                        onBlur={() => setIsEditingName(false)}
                        onChange={(event) => {
                            onUpdateBox({ ...box, name: event.target.value });
                            setIsEditingName(false);
                        }}
                        style={{ width: '100%', padding: '2px', border: '1px solid #ccc' }}
                    >
                        {labelTypes.map((labelType) => (
                            <option>
                                {labelType.name}
                            </option>
                        ))}
                    </select>
                ) : (
                    <strong onClick={handleNameClick} style={{
                        /* cursor: 'pointer', background: '#eee', padding: '2px 5px', borderRadius: '3px' */
                        cursor: 'pointer',
                        background: '#eee',
                        padding: '2px 5px',
                        borderRadius: '3px',
                        display: 'block',   // Make it a block element
                        width: '100%',      // Ensure it takes up all available space
                        textAlign: 'left',  // You can adjust this to 'center' or 'right' if you want
                    }}>
                        {box.name}
                    </strong>
                )}
            </div>

            {/* Start Time */}
            <button onClick={handleSetStart} style={{
                padding: '2px 10px',
                marginLeft: 'auto',
            }} aria-label="Set Start Time">
                <span style={{ marginRight: '5px', position: 'relative', top: '-1px' }}>⧯</span> {formatTime(box.start)}
            </button>


            <div></div>

            {/* End Time */}
            <button onClick={handleSetEnd} style={{
                padding: '2px 10px',
                marginRight: 'auto',
            }} aria-label="Set End Time">
                {formatTime(box.end)} <span style={{ marginLeft: '5px', position: 'relative', top: '-1px' }}>⧯</span>
            </button>

            {/* Buttons */}
            <button onClick={() => onDeleteBox(box.id)} style={{ padding: '2px 5px', color: 'red' }} aria-label="Delete Box">✖</button> {/* Using a cross icon */}
        </div>
    );
};

export default SidebarItem;
