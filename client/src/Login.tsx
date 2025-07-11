import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    // Ensure user is logged out.
    useEffect(() => {
        // Ensure user is logged out.
        fetch(`${BACKEND_URL}/logout`, {
            method: 'POST',
            credentials: 'include',
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // Login.
        const response = await fetch(`${BACKEND_URL}/login`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();
        if (data.status === "success") {
            navigate('/app');
        } else {
            alert('Login failed');
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div>
                <label>Username: </label>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
            </div>
            <div>
                <label>Password: </label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </div>
            <button type="submit">Login</button>
        </form>
    );
}

export default Login;
