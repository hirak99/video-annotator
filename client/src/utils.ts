export const stringToHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

export const hashToHSLColor = (hash: number): string => {
    const hue = hash % 360; // Hue is between 0 and 359
    const saturation = 70; // Keep saturation constant for vibrant colors
    const lightness = 50; // Keep lightness constant
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};
