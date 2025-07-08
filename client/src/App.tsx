import './App.css';
import './VideoLabel.tsx'
import VideoPlayer from './VideoLabel';

function App() {
    return (
        <div className="App">
            <header className="App-header">
                <a
                    className="App-link"
                    href="https://reactjs.org"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    React: Video Labeler
                </a>
            </header>
            <VideoPlayer />
        </div>
    );
}

export default App;
