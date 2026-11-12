import { Router } from 'express';
import { 
    getSessions, 
    createSession, 
    getMessages, 
    sendMessage 
} from '../controllers/chatController.js';

const router = Router();

// Chat Session Endpoints
router.get('/sessions/:userId', getSessions);
router.post('/sessions', createSession);

// Chat Message Endpoints
router.get('/sessions/:sessionId/messages', getMessages);
router.post('/sessions/:sessionId/messages', sendMessage);

export default router;