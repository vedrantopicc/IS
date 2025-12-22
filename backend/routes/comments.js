import express from 'express';
import { requireAuth } from '../middleware/auth-middleware.js';
import {
  getEventComments,
  createComment,
  updateComment,
  deleteComment
} from '../controllers/comments-controller.js';

const router = express.Router();

router.get('/event/:eventId', requireAuth, getEventComments);

router.post('/event/:eventId', requireAuth, createComment);

router.put('/:commentId', requireAuth, updateComment);

router.delete('/:commentId', requireAuth, deleteComment);

export default router;