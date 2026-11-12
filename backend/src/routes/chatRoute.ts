import { Router } from 'express';
import { 
    getSessions, 
    createSession,
    deleteSession, 
    getMessages, 
    sendMessage 
} from '../controllers/chatController.js';

const router = Router();

// Chat Session Endpoints
router.get('/sessions/:userId', getSessions);
router.post('/sessions', createSession);
router.delete('/sessions/:sessionId', deleteSession);

// Chat Message Endpoints
router.get('/sessions/:sessionId/messages', getMessages);
router.post('/sessions/:sessionId/messages', sendMessage);

export default router;