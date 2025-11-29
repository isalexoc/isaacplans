"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface BlogCommentsProps {
  postId: string;
  postSlug: string;
}

interface CommentUser {
  id: string;
  imageUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  initials: string;
}

interface BlogComment {
  id: string;
  postId: string;
  postSlug: string;
  userId: string;
  parentId: string | null;
  body: string;
  status: string;
  createdAt: string;
  updatedAt: string | null;
  pending?: boolean;
  user?: CommentUser | null;
  likeCount?: number;
  isLiked?: boolean;
}

interface CommentWithReplies extends BlogComment {
  replies: CommentWithReplies[];
}

export function BlogComments({ postId, postSlug }: BlogCommentsProps) {
  const locale = useLocale();
  const { user } = useUser();
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());

  const t = (en: string, es: string) => (locale === "en" ? en : es);

  const fetchComments = async (cursor?: string) => {
    try {
      if (cursor) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      const url = new URL("/api/blog/comments", window.location.origin);
      url.searchParams.set("postId", postId);
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error("Failed to load comments");
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to load comments");
      }

      // Organize comments into tree structure (top-level with nested replies)
      const topLevel = (data.items || []).filter((c: BlogComment) => !c.parentId);
      const withReplies: CommentWithReplies[] = topLevel.map((comment: BlogComment) => ({
        ...comment,
        replies: [],
      }));

      setComments((prev) => (cursor ? [...prev, ...withReplies] : withReplies));
      setNextCursor(data.nextCursor || null);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const fetchReplies = async (parentId: string) => {
    if (loadingReplies.has(parentId)) return;
    
    setLoadingReplies((prev) => new Set(prev).add(parentId));

    try {
      const url = new URL("/api/blog/comments", window.location.origin);
      url.searchParams.set("postId", postId);
      url.searchParams.set("parentId", parentId);

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error("Failed to load replies");
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to load replies");
      }

      const replies: CommentWithReplies[] = (data.items || []).map((c: BlogComment) => ({
        ...c,
        replies: [],
      }));

      setComments((prev) =>
        prev.map((comment) =>
          comment.id === parentId
            ? { ...comment, replies }
            : comment
        )
      );
    } catch (error) {
      console.error("Error fetching replies:", error);
    } finally {
      setLoadingReplies((prev) => {
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
        // Fetch replies if not already loaded
        const comment = comments.find((c) => c.id === commentId);
        if (comment && comment.replies.length === 0) {
          fetchReplies(commentId);
        }
      }
      return next;
    });
  };

  const handleLike = async (commentId: string) => {
    if (!user) return;

    const comment = findComment(commentId);
    if (!comment) return;

    const previousLiked = comment.isLiked || false;
    const previousCount = comment.likeCount || 0;

    // Optimistic update
    updateCommentInTree(commentId, {
      isLiked: !previousLiked,
      likeCount: previousLiked ? previousCount - 1 : previousCount + 1,
    });

    try {
      const res = await fetch(`/api/blog/comments/${commentId}/like`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to like comment");
      }

      updateCommentInTree(commentId, {
        isLiked: data.liked,
        likeCount: data.count,
      });
    } catch (error) {
      console.error("Error liking comment:", error);
      // Rollback
      updateCommentInTree(commentId, {
        isLiked: previousLiked,
        likeCount: previousCount,
      });
    }
  };

  const findComment = (id: string): CommentWithReplies | null => {
    for (const comment of comments) {
      if (comment.id === id) return comment;
      const reply = comment.replies.find((r) => r.id === id);
      if (reply) return reply;
    }
    return null;
  };

  const updateCommentInTree = (id: string, updates: Partial<BlogComment>) => {
    setComments((prev) =>
      prev.map((comment) => {
        if (comment.id === id) {
          return { ...comment, ...updates };
        }
        return {
          ...comment,
          replies: comment.replies.map((reply) =>
            reply.id === id ? { ...reply, ...updates } : reply
          ),
        };
      })
    );
  };

  const handleSubmit = async () => {
    const value = newComment.trim();
    if (!value) return;
    setIsSubmitting(true);

    const optimistic: CommentWithReplies = {
      id: `temp-${Date.now()}`,
      postId,
      postSlug,
      userId: user?.id || "me",
      parentId: null,
      body: value,
      status: "approved",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pending: true,
      replies: [],
      likeCount: 0,
      isLiked: false,
      user: user
        ? {
            id: user.id,
            imageUrl: user.imageUrl || null,
            firstName: user.firstName || null,
            lastName: user.lastName || null,
            username: user.username || null,
            initials:
              user.firstName && user.lastName
                ? `${user.firstName[0]}${user.lastName[0]}`
                : user.firstName
                ? user.firstName[0]
                : user.username
                ? user.username[0].toUpperCase()
                : "?",
          }
        : null,
    };

    setComments((prev) => [optimistic, ...prev]);
    setNewComment("");

    try {
      const res = await fetch("/api/blog/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          postSlug,
          content: value,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to post comment");
      }

      setComments((prev) =>
        prev.map((c) =>
          c.id === optimistic.id
            ? { ...c, ...data.item, pending: false, user: data.item.user || c.user }
            : c
        )
      );
    } catch (error) {
      console.error("Error submitting comment:", error);
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      setNewComment(value);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (parentId: string) => {
    const value = replyText.trim();
    if (!value) return;
    setIsSubmittingReply(true);

    const parentComment = findComment(parentId);
    const optimistic: CommentWithReplies = {
      id: `temp-reply-${Date.now()}`,
      postId,
      postSlug,
      userId: user?.id || "me",
      parentId,
      body: value,
      status: "approved",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pending: true,
      replies: [],
      likeCount: 0,
      isLiked: false,
      user: user
        ? {
            id: user.id,
            imageUrl: user.imageUrl || null,
            firstName: user.firstName || null,
            lastName: user.lastName || null,
            username: user.username || null,
            initials:
              user.firstName && user.lastName
                ? `${user.firstName[0]}${user.lastName[0]}`
                : user.firstName
                ? user.firstName[0]
                : user.username
                ? user.username[0].toUpperCase()
                : "?",
          }
        : null,
    };

    // Add to parent's replies
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === parentId
          ? { ...comment, replies: [...comment.replies, optimistic] }
          : comment
      )
    );

    setReplyText("");
    setReplyingToId(null);

    try {
      const res = await fetch("/api/blog/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          postSlug,
          content: value,
          parentId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to post reply");
      }

      setComments((prev) =>
        prev.map((comment) =>
          comment.id === parentId
            ? {
                ...comment,
                replies: comment.replies.map((r) =>
                  r.id === optimistic.id
                    ? { ...r, ...data.item, pending: false, user: data.item.user || r.user }
                    : r
                ),
              }
            : comment
        )
      );
    } catch (error) {
      console.error("Error submitting reply:", error);
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === parentId
            ? {
                ...comment,
                replies: comment.replies.filter((r) => r.id !== optimistic.id),
              }
            : comment
        )
      );
      setReplyText(value);
      setReplyingToId(parentId);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleEdit = (comment: CommentWithReplies) => {
    setEditingId(comment.id);
    setEditText(comment.body);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleSaveEdit = async (commentId: string) => {
    const value = editText.trim();
    if (!value) return;
    setIsSavingEdit(true);

    const comment = findComment(commentId);
    const previousBody = comment?.body || "";

    updateCommentInTree(commentId, { body: value, pending: true });

    try {
      const res = await fetch(`/api/blog/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update comment");
      }

      updateCommentInTree(commentId, { ...data.item, pending: false });
      setEditingId(null);
      setEditText("");
    } catch (error) {
      console.error("Error updating comment:", error);
      updateCommentInTree(commentId, { body: previousBody, pending: false });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm(t("Are you sure you want to delete this comment?", "¿Estás seguro de que quieres eliminar este comentario?"))) {
      return;
    }

    setDeletingId(commentId);

    // Optimistic update
    setComments((prev) =>
      prev
        .filter((c) => c.id !== commentId)
        .map((c) => ({
          ...c,
          replies: c.replies.filter((r) => r.id !== commentId),
        }))
    );

    try {
      const res = await fetch(`/api/blog/comments/${commentId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete comment");
      }

      fetchComments();
    } catch (error) {
      console.error("Error deleting comment:", error);
      fetchComments();
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const renderComment = (comment: CommentWithReplies, isReply = false) => {
    const isOwnComment = user?.id === comment.userId;
    const isEditing = editingId === comment.id;
    const isDeleting = deletingId === comment.id;
    const isReplying = replyingToId === comment.id;
    const hasReplies = comment.replies.length > 0;
    const repliesExpanded = expandedReplies.has(comment.id);
    const isLoadingReplies = loadingReplies.has(comment.id);

    return (
      <li
        key={comment.id}
        className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 ${
          isReply ? "ml-8 mt-3" : ""
        }`}
      >
        <div className="px-4 py-3">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            {comment.user ? (
              <Avatar className="h-8 w-8 flex-shrink-0">
                {comment.user.imageUrl ? (
                  <AvatarImage
                    src={comment.user.imageUrl}
                    alt={
                      comment.user.firstName && comment.user.lastName
                        ? `${comment.user.firstName} ${comment.user.lastName}`
                        : comment.user.username || "User"
                    }
                  />
                ) : null}
                <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium">
                  {comment.user.initials}
                </AvatarFallback>
              </Avatar>
            ) : (
              <Skeleton className="h-8 w-8 rounded-full" />
            )}

            <div className="flex-1 min-w-0">
              {/* User name */}
              {comment.user && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {comment.user.firstName && comment.user.lastName
                      ? `${comment.user.firstName} ${comment.user.lastName}`
                      : comment.user.firstName || comment.user.username || "Anonymous"}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(comment.createdAt).toLocaleString(locale, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                      <span className="ml-1">({t("edited", "editado")})</span>
                    )}
                  </span>
                </div>
              )}

              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(comment.id)}
                      disabled={!editText.trim() || isSavingEdit}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSavingEdit
                        ? t("Saving...", "Guardando...")
                        : t("Save", "Guardar")}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isSavingEdit}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {t("Cancel", "Cancelar")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words mb-2">
                    {comment.body}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    {/* Like button - hidden for own comments (industry standard) */}
                    {!isOwnComment && (
                      <>
                        {/* @ts-ignore - Clerk React 19 compatibility */}
                        <SignedIn>
                          <button
                            type="button"
                            onClick={() => handleLike(comment.id)}
                            className={`flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${
                              comment.isLiked
                                ? "text-blue-600 dark:text-blue-400"
                                : ""
                            }`}
                          >
                            <svg
                              className="w-4 h-4"
                              fill={comment.isLiked ? "currentColor" : "none"}
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                              />
                            </svg>
                            {comment.likeCount || 0}
                          </button>
                        </SignedIn>
                        {/* @ts-ignore - Clerk React 19 compatibility */}
                        <SignedOut>
                          <SignInButton mode="modal">
                            <button
                              type="button"
                              className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                />
                              </svg>
                              {comment.likeCount || 0}
                            </button>
                          </SignInButton>
                        </SignedOut>
                      </>
                    )}
                    {/* Show like count only (no button) for own comments */}
                    {isOwnComment && (
                      <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          />
                        </svg>
                        {comment.likeCount || 0}
                      </span>
                    )}

                    {/* Reply button */}
                    {!isReply && (
                      /* @ts-ignore - Clerk React 19 compatibility */
                      <SignedIn>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingToId(comment.id);
                            setReplyText("");
                          }}
                          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {t("Reply", "Responder")}
                        </button>
                      </SignedIn>
                    )}

                    {/* Edit/Delete (own comments only) */}
                    {isOwnComment && !comment.pending && !isDeleting && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEdit(comment)}
                          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {t("Edit", "Editar")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(comment.id)}
                          className="hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          {t("Delete", "Eliminar")}
                        </button>
                      </>
                    )}

                    {comment.pending && (
                      <span className="text-gray-400">
                        {t("Posting...", "Publicando...")}
                      </span>
                    )}

                    {isDeleting && (
                      <span className="text-gray-400">
                        {t("Deleting...", "Eliminando...")}
                      </span>
                    )}
                  </div>

                  {/* Reply form */}
                  {isReplying && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={t("Write a reply...", "Escribe una respuesta...")}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleReply(comment.id)}
                          disabled={!replyText.trim() || isSubmittingReply}
                          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSubmittingReply
                            ? t("Posting...", "Publicando...")
                            : t("Post reply", "Publicar respuesta")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingToId(null);
                            setReplyText("");
                          }}
                          disabled={isSubmittingReply}
                          className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {t("Cancel", "Cancelar")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Show replies button */}
                  {hasReplies && !isReply && (
                    <button
                      type="button"
                      onClick={() => toggleReplies(comment.id)}
                      className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {repliesExpanded
                        ? t("Hide replies", "Ocultar respuestas")
                        : t(`Show ${comment.replies.length} ${comment.replies.length === 1 ? "reply" : "replies"}`, `Mostrar ${comment.replies.length} ${comment.replies.length === 1 ? "respuesta" : "respuestas"}`)}
                    </button>
                  )}

                  {/* Loading replies */}
                  {isLoadingReplies && (
                    <div className="mt-2">
                      <Skeleton className="h-4 w-32" />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Nested replies */}
        {repliesExpanded && hasReplies && (
          <ul className="border-t border-gray-200 dark:border-gray-700 pt-2">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <section className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        {t("Comments", "Comentarios")}
      </h2>

      {/* New comment form */}
      <div className="mb-6">
        {/* @ts-ignore - Clerk React 19 compatibility */}
        <SignedIn>
          <div className="space-y-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={t(
                "Write a comment...",
                "Escribe un comentario..."
              )}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t(
                  "Be respectful and stay on topic.",
                  "Sé respetuoso y mantente en el tema."
                )}
              </p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!newComment.trim() || isSubmitting}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting
                  ? t("Posting...", "Publicando...")
                  : t("Post comment", "Publicar comentario")}
              </button>
            </div>
          </div>
        </SignedIn>

        {/* @ts-ignore - Clerk React 19 compatibility */}
        <SignedOut>
          <SignInButton mode="modal">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {t("Sign in to comment", "Inicia sesión para comentar")}
            </button>
          </SignInButton>
        </SignedOut>
      </div>

      {/* Comments list */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("No comments yet. Be the first to comment!", "Aún no hay comentarios. ¡Sé el primero en comentar!")}
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => renderComment(comment))}
        </ul>
      )}

      {nextCursor && !isLoading && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => fetchComments(nextCursor || undefined)}
            disabled={isLoadingMore}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoadingMore
              ? t("Loading...", "Cargando...")
              : t("Load more comments", "Cargar más comentarios")}
          </button>
        </div>
      )}
    </section>
  );
}
