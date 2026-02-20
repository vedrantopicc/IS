import { useState, useEffect, useMemo } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { MessageCircle, Edit2, Trash2, Save, X, Star } from "lucide-react";
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

// Star Rating Component
function StarRating({ rating, onRatingChange, readOnly = false, size = "md" }) {
  const [hover, setHover] = useState(0);
  
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6"
  };
  
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          className={`${readOnly ? "cursor-default" : "cursor-pointer"} transition-colors`}
          onClick={() => !readOnly && onRatingChange && onRatingChange(star)}
          onMouseEnter={() => !readOnly && setHover(star)}
          onMouseLeave={() => !readOnly && setHover(0)}
        >
          <Star
            className={`${sizeClasses[size]} ${
              star <= (hover || rating)
                ? "fill-yellow-400 text-yellow-400"
                : "fill-gray-300 text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function Comments({ eventId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [newRating, setNewRating] = useState(0);
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState("");
  const [editRating, setEditRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userReview, setUserReview] = useState(null);
  
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
      
      // Find if current user already has a review
      if (currentUserId) {
        const myReview = commentsData.find(
          c => c.user_id === parseInt(currentUserId)
        );
        setUserReview(myReview || null);
      }
    } catch (error) {
      console.error("Failed to load comments:", error);
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    // Validacija: OCENA JE OBAVEZNA
    if (newRating < 1 || newRating > 5) {
      toast.error("Please select a rating (1-5 stars)");
      return;
    }
  
    // Validacija dužine teksta (ako postoji)
    if (newComment.length > 1000) {
      toast.error("Comment is too long (max 1000 characters)");
      return;
    }
  
    try {
      setSubmitting(true);
      const comment = await createComment(eventId, newComment.trim(), newRating);
      setComments(prev => [comment, ...prev]);
      setUserReview(comment);
      setNewComment("");
      setNewRating(0);
      toast.success("Review added successfully");
    } catch (error) {
      console.error("Failed to add review:", error);
      toast.error(error.message || "Failed to add review");
    } finally {
      setSubmitting(false);
    }
  };

// U handleEditComment:
const handleEditComment = async (commentId) => {
  // Validacija: OCENA JE OBAVEZNA
  if (editRating < 1 || editRating > 5) {
    toast.error("Please select a rating (1-5 stars)");
    return;
  }

  // Validacija dužine teksta (ako postoji)
  if (editText.length > 1000) {
    toast.error("Comment is too long (max 1000 characters)");
    return;
  }

  try {
    setSubmitting(true);
    const updatedComment = await updateComment(commentId, editText.trim(), editRating);
    setComments(prev => 
      prev.map(comment => comment.id === commentId ? updatedComment : comment)
    );
    setUserReview(updatedComment);
    setEditingComment(null);
    setEditText("");
    setEditRating(0);
    toast.success("Review updated successfully");
  } catch (error) {
    console.error("Failed to update review:", error);
    toast.error(error.message || "Failed to update review");
  } finally {
    setSubmitting(false);
  }
};

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this review?")) {
      return;
    }

    try {
      setSubmitting(true);
      await deleteComment(commentId);
      setComments(prev => prev.filter(comment => comment.id !== commentId));
      setUserReview(null);
      toast.success("Review deleted successfully");
    } catch (error) {
      console.error("Failed to delete review:", error);
      toast.error(error.message || "Failed to delete review");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (comment) => {
    setEditingComment(comment.id);
    setEditText(comment.comment_text);
    setEditRating(comment.rating);
  };

  const cancelEdit = () => {
    setEditingComment(null);
    setEditText("");
    setEditRating(0);
  };

  if (!token) {
    return null; 
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          {isStudent && !userReview && (
            <div className="space-y-3 border-b border-gray-200 pb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Rating *
                </label>
                <StarRating
                  rating={newRating}
                  onRatingChange={setNewRating}
                  size="lg"
                />
              </div>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your experience at this event..."
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
                  disabled={submitting || newRating === 0}
                  className="!bg-blue-600 hover:!bg-blue-700 !text-white cursor-pointer transition-colors disabled:cursor-not-allowed"
                >
                  {submitting ? "Adding..." : "Submit Review"}
                </Button>
              </div>
            </div>
          )}

          {/*isStudent && userReview && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                You have already reviewed this event. You can edit or delete your review below.
              </p>
            </div>
          )*/}

          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-500">Loading reviews...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-500">No reviews yet. Be the first to share your experience!</p>
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
                          <div className="flex items-center gap-2">
                            <StarRating rating={comment.rating} readOnly size="sm" />
                            <span className="text-sm text-gray-500">
                              {formatDate(comment.created_at)}
                              {comment.updated_at !== comment.created_at && (
                                <span className="ml-1">(edited)</span>
                              )}
                            </span>
                          </div>
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
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">
                            Your Rating *
                          </label>
                          <StarRating
                            rating={editRating}
                            onRatingChange={setEditRating}
                            size="lg"
                          />
                        </div>
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
                              disabled={submitting || editRating === 0}
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