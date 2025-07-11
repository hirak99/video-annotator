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
                <select
                    key={box.id}
                    value={box.name}
                    onChange={(event) => {
                        onUpdateBox({ ...box, name: event.target.value });
                    }}
                    style={{ width: '100%', padding: '2px', border: '1px solid #ccc' }}
                >
                    {labelTypes.map((labelType) => (
                        <option key={labelType.name} value={labelType.name}>
                            {labelType.name}
                        </option>
                    ))}
                </select>
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
