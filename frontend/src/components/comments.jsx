import { useState, useEffect, useMemo } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { MessageCircle, Edit2, Trash2, Save, X } from "lucide-react";
import { getEventComments, createComment, updateComment, deleteComment } from "../services/comments";
import { toast } from "react-toastify";

function getToken() { 
  return localStorage.getItem("token"); 
}

function decodeJwt(token) { 
  try { 
    const b = token.split(".")[1]; 
    const j = atob(b.replace(/-/g, "+").replace(/_/g, "/")); 
    return JSON.parse(decodeURIComponent(escape(j))); 
  } catch { 
    return null; 
  } 
}

function getCurrentUserRole() {
  const token = getToken();
  if (!token) return null;
  
  const userStr = localStorage.getItem("user");
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      return user.role;
    } catch {}
  }
  
  return null;
}

function formatDate(dateString) {
  if (!dateString) return "Unknown time";
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    console.error("Invalid date:", dateString);
    return "Invalid date";
  }
  
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  console.log("Date parsing:", {
    original: dateString,
    parsed: date.toISOString(),
    now: now.toISOString(),
    diffInSeconds
  });
  
  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  
  return date.toLocaleDateString(undefined, { 
    year: "numeric", 
    month: "short", 
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getInitials(name, surname, username) {
  if (name && surname) {
    return `${name[0]}${surname[0]}`.toUpperCase();
  }
  if (username) {
    return username.substring(0, 2).toUpperCase();
  }
  return "U";
}

export default function Comments({ eventId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const token = getToken();
  const payload = useMemo(() => token ? decodeJwt(token) : null, [token]);
  const userRole = useMemo(() => getCurrentUserRole(), []);
  const isStudent = userRole === "Student";
  const currentUserId = payload?.sub;

  useEffect(() => {
    if (eventId) {
      loadComments();
    }
  }, [eventId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const commentsData = await getEventComments(eventId);
      setComments(commentsData);
    } catch (error) {
      console.error("Failed to load comments:", error);
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    if (newComment.length > 1000) {
      toast.error("Comment is too long (max 1000 characters)");
      return;
    }

    try {
      setSubmitting(true);
      const comment = await createComment(eventId, newComment);
      setComments(prev => [comment, ...prev]);
      setNewComment("");
      toast.success("Comment added successfully");
    } catch (error) {
      console.error("Failed to add comment:", error);
      toast.error(error.message || "Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId) => {
    if (!editText.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    if (editText.length > 1000) {
      toast.error("Comment is too long (max 1000 characters)");
      return;
    }

    try {
      setSubmitting(true);
      const updatedComment = await updateComment(commentId, editText);
      setComments(prev => 
        prev.map(comment => 
          comment.id === commentId ? updatedComment : comment
        )
      );
      setEditingComment(null);
      setEditText("");
      toast.success("Comment updated successfully");
    } catch (error) {
      console.error("Failed to update comment:", error);
      toast.error(error.message || "Failed to update comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    try {
      setSubmitting(true);
      await deleteComment(commentId);
      setComments(prev => prev.filter(comment => comment.id !== commentId));
      toast.success("Comment deleted successfully");
    } catch (error) {
      console.error("Failed to delete comment:", error);
      toast.error(error.message || "Failed to delete comment");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (comment) => {
    setEditingComment(comment.id);
    setEditText(comment.comment_text);
  };

  const cancelEdit = () => {
    setEditingComment(null);
    setEditText("");
  };

  if (!token) {
    return null; 
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <MessageCircle className="h-5 w-5 text-blue-500" />
            Comments ({comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isStudent && (
            < div className="space-y-3 border-b border-gray-200 pb-4">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your thoughts about this event..."
                className="bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-400 resize-none focus-visible:ring-2 focus-visible:ring-blue-500"
                rows={3}
                maxLength={1000}
                disabled={submitting}
              />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {newComment.length}/1000 characters
                </span>
                <Button
                  onClick={handleAddComment}
                  disabled={submitting || !newComment.trim()}
                  className="!bg-blue-600 hover:!bg-blue-700 !text-white cursor-pointer transition-colors disabled:cursor-not-allowed"
                >
                  {submitting ? "Adding..." : "Add Comment"}
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-500">Loading comments...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-gray-500  mx-auto mb-3" />
              <p className="text-gray-500 ">No comments yet. Be the first to share your thoughts!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => {
                const isOwner = currentUserId && comment.user_id === parseInt(currentUserId);
                const isEditing = editingComment === comment.id;
                const displayName = comment.name && comment.surname 
                  ? `${comment.name} ${comment.surname}` 
                  : comment.username;

                return (
                  <div key={comment.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 hover:bg-gray-100 transition">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-semibold">
                            {getInitials(comment.name, comment.surname, comment.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                        <p className="font-medium text-gray-900">{displayName}</p>
                          <p className="text-sm text-gray-500">
                            {formatDate(comment.created_at)}
                            {comment.updated_at !== comment.created_at && (
                              <span className="ml-1">(edited)</span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      {isStudent && isOwner && !isEditing && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(comment)}
                            className="text-gray-600 hover:text-white hover:bg-gray-900 cursor-pointer transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-red-400 hover:text-red-500 hover:bg-red-100/20 cursor-pointer transition-colors"
                            disabled={submitting}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {isEditing ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 resize-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          rows={3}
                          maxLength={1000}
                          disabled={submitting}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">    
                            {editText.length}/1000 characters
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEdit}
                              className="text-gray-600 hover:text-gray-900 hover:bg-gray-900 cursor-pointer transition-colors"
                              disabled={submitting}
                            >
                              <X className="w-4 h-4" />
                              Cancel
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditComment(comment.id)}
                              disabled={submitting || !editText.trim()}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Save className="w-4 h-4 mr-1" />
                              {submitting ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {comment.comment_text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
