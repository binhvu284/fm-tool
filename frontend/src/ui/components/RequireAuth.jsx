import React from 'react';
import { Navigate } from 'react-router-dom';

export default function RequireAuth({ children, role }) {
    const token = localStorage.getItem('token');
    const storedRole = localStorage.getItem('role');
    if (!token) return <Navigate to="/login" replace />;
    if (role && storedRole !== role) return <Navigate to="/" replace />;
    return children;
}
