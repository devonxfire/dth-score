import { io } from 'socket.io-client';
import { API_BASE } from './api';

// Determine backend URL for socket connection.
// If API_BASE is empty (dev with proxy), use window.location.origin
const backendBase = API_BASE && API_BASE !== '' ? API_BASE : window.location.origin;

// Create a single socket instance used across the app
const socket = io(backendBase, { transports: ['websocket', 'polling'] });

export default socket;
