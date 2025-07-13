import React, { useState, useEffect } from 'react';
import { Box } from './types';
import { hashToHSLColor, stringToHash } from './utils';

interface LabelRendererProps {
    boxes: Box[];
    currentTime: number;
    videoDimensions: {
        naturalWidth: number;
        naturalHeight: number;
        displayWidth: number;
        displayHeight: number;
    };
    handleUpdateBox: (updatedBox: Box) => void;
    setBoxes: (updatedBoxes: Box[]) => void;
    selectedBoxId: string | null;
    setSelectedBoxId: (id: string | null) => void;
}

const LabelRenderer: React.FC<LabelRendererProps> = ({
    boxes,
    currentTime,
    videoDimensions,
    handleUpdateBox,
    setBoxes,
    selectedBoxId,
    setSelectedBoxId
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const scaleFactorX = videoDimensions.naturalWidth / videoDimensions.displayWidth;
    const scaleFactorY = videoDimensions.naturalHeight / videoDimensions.displayHeight;
    const outlineBorder = 2;

    // Keyboard shortcuts for moving/resizing selected box
    useEffect(() => {
        if (!selectedBoxId) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            // Only act if a box is selected and no input is focused
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || (document.activeElement as HTMLElement).isContentEditable)) {
                return;
            }

            const boxIndex = boxes.findIndex(b => b.id === selectedBoxId);
            if (boxIndex === -1) return;
            const box = boxes[boxIndex];

            let dx = 0, dy = 0, dWidth = 0, dHeight = 0;
            const moveAmount = event.ctrlKey ? 5 : 1;

            // Arrow keys: move; Shift+Arrow: resize
            switch (event.key) {
                case 'ArrowLeft':
                    if (event.shiftKey) dWidth = -moveAmount;
                    else dx = -moveAmount;
                    break;
                case 'ArrowRight':
                    if (event.shiftKey) dWidth = moveAmount;
                    else dx = moveAmount;
                    break;
                case 'ArrowUp':
                    if (event.shiftKey) dHeight = -moveAmount;
                    else dy = -moveAmount;
                    break;
                case 'ArrowDown':
                    if (event.shiftKey) dHeight = moveAmount;
                    else dy = moveAmount;
                    break;
                default:
                    return;
            }

            // Prevent scrolling
            event.preventDefault();

            let updatedBox = { ...box };
            if (dx !== 0 || dy !== 0) {
                updatedBox.x = Math.max(0, box.x + dx * scaleFactorX);
                updatedBox.y = Math.max(0, box.y + dy * scaleFactorY);
            }
            if (dWidth !== 0 || dHeight !== 0) {
                updatedBox.width = Math.max(1, box.width + dWidth * scaleFactorX);
                updatedBox.height = Math.max(1, box.height + dHeight * scaleFactorY);
            }

            // Only update if something changed
            if (
                updatedBox.x !== box.x ||
                updatedBox.y !== box.y ||
                updatedBox.width !== box.width ||
                updatedBox.height !== box.height
            ) {
                const newBoxes = boxes.map((b, i) => i === boxIndex ? updatedBox : b);
                setBoxes(newBoxes);
                handleUpdateBox(updatedBox);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedBoxId, boxes, setBoxes, handleUpdateBox, scaleFactorX, scaleFactorY]);

    const isEventAtBottomRight = (event: React.MouseEvent<HTMLElement>) => {
        const target = event.target as HTMLElement;
        const rect = target.getBoundingClientRect();
        return event.clientX >= rect.right - 10 && event.clientX <= rect.right &&
            event.clientY >= rect.bottom - 10 && event.clientY <= rect.bottom;
    };

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: isDragging ? 'auto' : 'none' }}>
            {boxes
                .map((box, originalIndex) => ({ ...box, originalIndex }))
                .filter(box => currentTime >= box.start && currentTime <= box.end)
                .map(box => (
                    <div
                        key={box.id}
                        data-box-id={box.id}
                        style={{
                            position: 'absolute',
                            top: `${box.y / scaleFactorY}px`,
                            left: `${box.x / scaleFactorX}px`,
                            width: `${box.width / scaleFactorX - 2 * outlineBorder}px`,
                            height: `${box.height / scaleFactorY - 2 * outlineBorder}px`,
                            border: `${outlineBorder}px solid ${hashToHSLColor(stringToHash(box.name))}`,
                            background: `${hashToHSLColor(stringToHash(box.name)).replace('hsl', 'hsla').replace(')', ', 0.3)')}`,
                            pointerEvents: 'auto',
                            boxShadow: box.id === selectedBoxId ? '0 0 0 3px #1976d2, 0 0 8px 2px #1976d2' : undefined,
                            zIndex: box.id === selectedBoxId ? 2 : 1,
                        }}
                        onMouseDown={(event) => {
                            // Only activate on left click, ignore other clicks.
                            if (event.button !== 0) {
                                return;
                            }
                            event.preventDefault();  // Prevent default e.g. click and drag selection.
                            event.stopPropagation();
                            setIsDragging(true);
                            const boxRef = event.currentTarget;
                            const boxId = boxRef.getAttribute('data-box-id');
                            let box = boxes.find(b => b.id === boxId);
                            if (box) {
                                setSelectedBoxId(selectedBoxId === box.id ? null : box.id);

                                const startX = event.clientX;
                                const startY = event.clientY;
                                const initialX = box.x;
                                const initialY = box.y;
                                const initialWidth = box.width;
                                const initialHeight = box.height;

                                const isBottomRight = isEventAtBottomRight(event);

                                const handleMouseMove = (event: MouseEvent) => {
                                    // Remove thick border while moving.
                                    setSelectedBoxId(null);

                                    const deltaX = event.clientX - startX;
                                    const deltaY = event.clientY - startY;

                                    if (isBottomRight) {
                                        let newWidth = initialWidth + deltaX * scaleFactorX;
                                        let newHeight = initialHeight + deltaY * scaleFactorY;
                                        box = { ...box!, width: newWidth, height: newHeight };
                                    } else {
                                        const newX = initialX + deltaX * scaleFactorX;
                                        const newY = initialY + deltaY * scaleFactorY;
                                        box = { ...box!, x: newX, y: newY };
                                    }
                                    setBoxes(boxes.map(b => b.id === boxId ? box! : b));
                                };

                                const handleMouseUp = (event: MouseEvent) => {
                                    setIsDragging(false);
                                    document.removeEventListener('mousemove', handleMouseMove);
                                    document.removeEventListener('mouseup', handleMouseUp);

                                    // Update only if mouse moved, and not just clicked.
                                    if (event.clientX !== startX || event.clientY !== startY) {
                                        handleUpdateBox(box!);
                                    }
                                };

                                document.addEventListener('mousemove', handleMouseMove);
                                document.addEventListener('mouseup', handleMouseUp);
                            }
                        }}
                        onMouseMove={(event) => {
                            const boxRef = event.currentTarget;
                            const boxId = boxRef.getAttribute('data-box-id');
                            const box = boxes.find(b => b.id === boxId);
                            if (box) {
                                if (isEventAtBottomRight(event)) {
                                    boxRef.style.cursor = 'se-resize';
                                } else {
                                    boxRef.style.cursor = 'move';
                                }
                            }
                        }}
                    >
                        {box.originalIndex + 1}. {box.name}
                    </div>
                ))}
        </div>
    );
};

export default LabelRenderer;
