import { TinyColor } from '@ctrl/tinycolor';
import React, { useState, useEffect, useCallback } from 'react';
import { AnnotationProps } from './types';
import { hashToHSLColor, stringToHash } from './utils';

interface LabelRendererProps {
    boxes: AnnotationProps[];
    currentTime: number;
    videoDimensions: {
        naturalWidth: number;
        naturalHeight: number;
        displayWidth: number;
        displayHeight: number;
    };
    handleUpdateBox: (updatedBox: AnnotationProps) => void;
    setBoxes: (updatedBoxes: AnnotationProps[]) => void;
    setAndUpdateBoxes: (updatedBoxes: AnnotationProps[]) => void;
    selectedBoxId: string | null;
    setSelectedBoxId: (id: string | null) => void;
    labelTypes: import('./types').LabelType[];
}

const LabelRenderer: React.FC<LabelRendererProps> = ({
    boxes,
    currentTime,
    videoDimensions,
    handleUpdateBox,
    setBoxes,
    setAndUpdateBoxes,
    selectedBoxId,
    setSelectedBoxId,
    labelTypes
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const scaleFactorX = videoDimensions.naturalWidth / videoDimensions.displayWidth;
    const scaleFactorY = videoDimensions.naturalHeight / videoDimensions.displayHeight;
    const outlineBorder = 2;

    const isAnnotationVisible = useCallback((ann: AnnotationProps) => {
        return ann && currentTime >= ann.label.start && currentTime <= ann.label.end;
    }, [currentTime]);

    // Keyboard shortcuts for moving/resizing selected box
    useEffect(() => {
        if (!selectedBoxId) return;

        const boxIndex = boxes.findIndex(b => b.id === selectedBoxId);
        if (boxIndex === -1) return;
        const box = boxes[boxIndex];
        if (!isAnnotationVisible(box)) return;


        const handleKeyDown = (event: KeyboardEvent) => {
            // // Only act if a box is selected and no input is focused
            // if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || (document.activeElement as HTMLElement).isContentEditable)) {
            //     return;
            // }

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

            // Deepcopy the label, which has location and size.
            let updatedBox = { ...box, label: { ...box.label } };
            if (dx !== 0 || dy !== 0) {
                updatedBox.label.x += dx * scaleFactorX;
                updatedBox.label.y += dy * scaleFactorY;
            }
            if (dWidth !== 0 || dHeight !== 0) {
                updatedBox.label.width += dWidth * scaleFactorX;
                updatedBox.label.height += dHeight * scaleFactorY;
            }

            // Only update if something changed
            if (
                updatedBox.label.x !== box.label.x ||
                updatedBox.label.y !== box.label.y ||
                updatedBox.label.width !== box.label.width ||
                updatedBox.label.height !== box.label.height
            ) {
                const newBoxes = boxes.map((b, i) => i === boxIndex ? updatedBox : b);
                // Throttled save all edits after a short delay.
                setAndUpdateBoxes(newBoxes);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedBoxId, boxes, setBoxes, setAndUpdateBoxes, scaleFactorX, scaleFactorY, isAnnotationVisible]);

    const isEventAtBottomRight = (event: React.MouseEvent<HTMLElement>) => {
        const target = event.target as HTMLElement;
        const rect = target.getBoundingClientRect();
        return event.clientX >= rect.right - 10 && event.clientX <= rect.right &&
            event.clientY >= rect.bottom - 10 && event.clientY <= rect.bottom;
    };

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: isDragging ? 'auto' : 'none' }}>
            {selectedBoxId && (() => {
                const selectedBox = boxes.find(b => b.id === selectedBoxId);
                if (!selectedBox) return null;
                if (!isAnnotationVisible(selectedBox)) return null;
                // Is the box visible?
                if (currentTime < selectedBox.label.start || currentTime > selectedBox.label.end) {
                    return null;
                }
                const tipWidth = 160;
                const left = selectedBox.label.x / scaleFactorX;
                const top = (selectedBox.label.y + selectedBox.label.height) / scaleFactorY + 6;
                return (
                    <div style={{
                        position: 'absolute',
                        top,
                        left,
                        width: tipWidth,
                        zIndex: 100,
                        background: 'rgba(255,255,255,0.5)',
                        color: '#333',
                        borderRadius: 4,
                        padding: '4px 10px',
                        fontSize: 13,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        textAlign: 'left',
                        pointerEvents: 'none'
                    }}>
                        <div><b>Keyboard Shortcuts:</b></div>
                        <div>(Ctrl +) Arrow = move</div>
                        <div>(Ctrl +) Shift + Arrow = size</div>
                    </div>
                );
            })()}
            {boxes
                .map((box, originalIndex) => ({ ...box, originalIndex }))
                .filter(box => currentTime >= box.label.start && currentTime <= box.label.end)
                .map(box => {
                    const labelType = labelTypes.find(lt => lt.name === box.name);
                    if (!labelType || !labelType.color) {
                        console.warn(`Color not defined for label type ${box.name}. Using default.`);
                    }
                    const boxColor = labelType && labelType.color ? labelType.color : hashToHSLColor(stringToHash(box.name));
                    const boxBg = new TinyColor(boxColor).setAlpha(0.3).toString();
                    return (
                        <div
                            key={box.id}
                            data-box-id={box.id}
                            style={{
                                whiteSpace: 'nowrap',
                                position: 'absolute',
                                top: `${box.label.y / scaleFactorY}px`,
                                left: `${box.label.x / scaleFactorX}px`,
                                width: `${box.label.width / scaleFactorX - 2 * outlineBorder}px`,
                                height: `${box.label.height / scaleFactorY - 2 * outlineBorder}px`,
                                border: `${outlineBorder}px solid ${boxColor}`,
                                background: `${boxBg}`,
                                pointerEvents: 'auto',
                                boxShadow: box.id === selectedBoxId ? '0 0 0 3px #1976d2, 0 0 8px 2px #1976d2' : '0 2px 5px rgba(0, 0, 0, 0.1)',
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
                                    const initialX = box.label.x;
                                    const initialY = box.label.y;
                                    const initialWidth = box.label.width;
                                    const initialHeight = box.label.height;

                                    const isBottomRight = isEventAtBottomRight(event);

                                    const handleMouseMove = (event: MouseEvent) => {
                                        // Remove thick border while moving.
                                        setSelectedBoxId(null);

                                        const deltaX = event.clientX - startX;
                                        const deltaY = event.clientY - startY;

                                        if (isBottomRight) {
                                            let newWidth = initialWidth + deltaX * scaleFactorX;
                                            let newHeight = initialHeight + deltaY * scaleFactorY;
                                            box = { ...box!, label: { ...box!.label, width: newWidth, height: newHeight } };
                                        } else {
                                            const newX = initialX + deltaX * scaleFactorX;
                                            const newY = initialY + deltaY * scaleFactorY;
                                            box = { ...box!, label: { ...box!.label, x: newX, y: newY } };
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
                                // Event is at bottom right of the current box.
                                const isBR = isEventAtBottomRight(event);
                                event.currentTarget.style.cursor = isBR ? 'se-resize' : 'move';
                            }}
                        >
                            {box.originalIndex + 1}. {box.name}
                        </div>
                    )
                })}
        </div>
    );
};

export default LabelRenderer;
