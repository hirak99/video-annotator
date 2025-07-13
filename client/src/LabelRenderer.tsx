import React, { useState } from 'react';
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
}

const LabelRenderer: React.FC<LabelRendererProps> = ({ boxes, currentTime, videoDimensions, handleUpdateBox, setBoxes }) => {
    const [isDragging, setIsDragging] = useState(false);
    const scaleFactorX = videoDimensions.naturalWidth / videoDimensions.displayWidth;
    const scaleFactorY = videoDimensions.naturalHeight / videoDimensions.displayHeight;
    const outlineBorder = 2;

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
                            // - 2 * outlineBorder because UI render the rectangles weirdly.
                            // With this adjustment, the border is rendered exactly inside.
                            // If we do not make the adjustment, in application we would see the bottom right to be off towards top-left.
                            width: `${box.width / scaleFactorX - 2 * outlineBorder}px`,
                            height: `${box.height / scaleFactorY - 2 * outlineBorder}px`,
                            border: `${outlineBorder}px solid ${hashToHSLColor(stringToHash(box.name))}`,
                            background: `${hashToHSLColor(stringToHash(box.name)).replace('hsl', 'hsla').replace(')', ', 0.3)')}`, // Add alpha for background
                            pointerEvents: 'auto',
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
                                const startX = event.clientX;
                                const startY = event.clientY;
                                const initialX = box.x;
                                const initialY = box.y;
                                const initialWidth = box.width;
                                const initialHeight = box.height;

                                const isBottomRight = isEventAtBottomRight(event);

                                const handleMouseMove = (event: MouseEvent) => {
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

                                const handleMouseUp = () => {
                                    setIsDragging(false);
                                    document.removeEventListener('mousemove', handleMouseMove);
                                    document.removeEventListener('mouseup', handleMouseUp);
                                    handleUpdateBox(box!);
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
