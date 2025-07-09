import React, { useState } from 'react';
import { Box } from './types';

interface SidebarItemProps {
    box: Box;
    onUpdateBox: (updatedBox: Box) => void;
    onDeleteBox: (boxId: string) => void; // Add onDeleteBox prop
    currentTime: number; // Add currentTime prop
}

const SidebarItem: React.FC<SidebarItemProps> = ({ box, onUpdateBox, onDeleteBox, currentTime }) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [isEditingStart, setIsEditingStart] = useState(false);
    const [isEditingEnd, setIsEditingEnd] = useState(false);
    const [boxName, setBoxName] = useState(box.name);
    const [startTime, setStartTime] = useState(box.start.toFixed(2));
    const [endTime, setEndTime] = useState(box.end.toFixed(2));

    const handleNameClick = () => {
        setIsEditingName(true);
    };

    const handleStartClick = () => {
        setIsEditingStart(true);
    };

    const handleEndClick = () => {
        setIsEditingEnd(true);
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBoxName(e.target.value);
    };

    const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStartTime(e.target.value);
    };

    const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEndTime(e.target.value);
    };

    const handleNameBlur = () => {
        onUpdateBox({ ...box, name: boxName });
        setIsEditingName(false);
    };

    const handleStartBlur = () => {
        const newStartTime = parseFloat(startTime);
        if (!isNaN(newStartTime)) {
            onUpdateBox({ ...box, start: newStartTime });
        } else {
            setStartTime(box.start.toFixed(2)); // Revert if invalid input
        }
        setIsEditingStart(false);
    };

    const handleEndBlur = () => {
        const newEndTime = parseFloat(endTime);
        if (!isNaN(newEndTime)) {
            onUpdateBox({ ...box, end: newEndTime });
        } else {
            setEndTime(box.end.toFixed(2)); // Revert if invalid input
        }
        setIsEditingEnd(false);
    };

    const handleSetStart = () => {
        onUpdateBox({ ...box, start: currentTime });
        setStartTime(currentTime.toFixed(2)); // Update local state immediately
    };

    const handleSetEnd = () => {
        onUpdateBox({ ...box, end: currentTime });
        setEndTime(currentTime.toFixed(2)); // Update local state immediately
    };


    return (
        <div style={{ borderBottom: '1px solid #eee', paddingBottom: '5px', marginBottom: '5px', display: 'grid', gridTemplateColumns: '120px 80px 80px 1fr', gap: '10px', alignItems: 'center' }}>
            {/* Box Name */}
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isEditingName ? (
                    <input
                        type="text"
                        value={boxName}
                        onChange={handleNameChange}
                        onBlur={handleNameBlur}
                        autoFocus
                        style={{ width: '100%', padding: '2px', border: '1px solid #ccc' }}
                    />
                ) : (
                    <strong onClick={handleNameClick} style={{ cursor: 'pointer', background: '#eee', padding: '2px 5px', borderRadius: '3px' }}>
                        {box.name}
                    </strong>
                )}
            </div>

            {/* Start Time */}
            <div>
                {isEditingStart ? (
                    <input
                        type="number"
                        step="0.01"
                        value={startTime}
                        onChange={handleStartTimeChange}
                        onBlur={handleStartBlur}
                        autoFocus
                        style={{ width: '100%', padding: '2px', border: '1px solid #ccc' }}
                    />
                ) : (
                    <span onClick={handleStartClick} style={{ cursor: 'pointer', background: '#eee', padding: '2px 5px', borderRadius: '3px' }}>
                        {box.start.toFixed(2)}s
                    </span>
                )}
            </div>

            {/* End Time */}
            <div>
                {isEditingEnd ? (
                    <input
                        type="number"
                        step="0.01"
                        value={endTime}
                        onChange={handleEndTimeChange}
                        onBlur={handleEndBlur}
                        autoFocus
                        style={{ width: '100%', padding: '2px', border: '1px solid #ccc' }}
                    />
                ) : (
                    <span onClick={handleEndClick} style={{ cursor: 'pointer', background: '#eee', padding: '2px 5px', borderRadius: '3px' }}>
                        {box.end.toFixed(2)}s
                    </span>
                )}
            </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={handleSetStart} style={{ padding: '2px 5px' }} aria-label="Set Start Time">◁</button> {/* Using a play icon */}
                    <button onClick={handleSetEnd} style={{ padding: '2px 5px' }} aria-label="Set End Time">▷</button> {/* Using a stop icon */}
                    <button onClick={() => onDeleteBox(box.id)} style={{ padding: '2px 5px', color: 'red' }} aria-label="Delete Box">✖</button> {/* Using a cross icon */}
                </div>
            </div>
    );
};

export default SidebarItem;
