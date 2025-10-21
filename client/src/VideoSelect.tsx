import React from 'react';
import Select from 'react-select';

interface VideoFileProps {
    video_file: string;
    label_file: string;
    readonly: boolean;
}

interface VideoSelectProps {
    videoFiles: VideoFileProps[];
    currentVideoIdx: number;
    setCurrentVideoIdx: React.Dispatch<React.SetStateAction<number>>;
}

const VideoSelect: React.FC<VideoSelectProps> = ({ videoFiles, currentVideoIdx, setCurrentVideoIdx }) => {
    const options = videoFiles.map((file, index) => ({
        value: index,
        label: file.video_file
    }));

    const selectedOption = options.find(option => option.value === currentVideoIdx);

    const handleChange = (selectedOption: any) => { // selectedOption type from react-select
        setCurrentVideoIdx(selectedOption ? selectedOption.value : null);
    };

    const customStyles = {
        control: (provided: any, state: any) => ({ // Using 'any' for simplicity, can be more specific with react-select types
            ...provided,
            backgroundColor: '#f0f0f0', // Light grey background
            borderColor: state.isFocused ? '#888' : '#ccc', // Keep border subtle
            boxShadow: state.isFocused ? '0 0 0 1px #888' : 'none', // Subtle focus shadow
            '&:hover': {
                borderColor: '#888', // Slightly darker border on hover
            },
            margin: '4px 0',
            minHeight: '30px',
            height: '30px',
        }),
        singleValue: (provided: any) => ({ // Using 'any' for simplicity
            ...provided,
            color: '#333', // Ensure text color is not greyed out
        }),
        input: (provided: any, state: any) => ({
            ...provided,
            margin: '0px',
        }),
        indicatorsContainer: (provided: any, state: any) => ({
            ...provided,
            height: '30px',
        }),
    };

    // Custom filter function for multi-word search
    const filterOption = (option: any, inputValue: string) => {
        if (!inputValue) return true;
        const words = inputValue
            .toLowerCase()
            .split(' ')
            .filter(Boolean);
        const label = option.data.label.toLowerCase();
        return words.every(word => label.includes(word));
    };

    return (
        <Select
            value={selectedOption}
            onChange={handleChange}
            options={options}
            isSearchable={true}
            placeholder="Select a video..."
            styles={customStyles}
            filterOption={filterOption}
        />
    );
};

export default VideoSelect;
