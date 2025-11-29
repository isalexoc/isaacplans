"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

interface BlogLikesAvatarsProps {
  postId: string;
}

interface LikeUser {
  id: string;
  imageUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  initials: string;
}

export function BlogLikesAvatars({ postId }: BlogLikesAvatarsProps) {
  const [users, setUsers] = useState<LikeUser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!postId) {
      setIsLoading(false);
      return;
    }

    fetch(`/api/blog/likes/users?postId=${postId}&limit=5`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUsers(data.users || []);
          setTotalCount(data.totalCount || 0);
        }
      })
      .catch((error) => {
        console.error("Error fetching like users:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [postId]);

  // Listen for like updates to refresh
  useEffect(() => {
    const handleLikeUpdate = () => {
      // Refresh after a short delay to allow DB to update
      setTimeout(() => {
        fetch(`/api/blog/likes/users?postId=${postId}&limit=5`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setUsers(data.users || []);
              setTotalCount(data.totalCount || 0);
            }
          })
          .catch((error) => {
            console.error("Error refreshing like users:", error);
          });
      }, 500);
    };

    window.addEventListener("blog-likes-updated", handleLikeUpdate);
    return () => {
      window.removeEventListener("blog-likes-updated", handleLikeUpdate);
    };
  }, [postId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 mb-4">
        <div className="flex -space-x-2">
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              className="h-8 w-8 rounded-full border-2 border-white dark:border-gray-900"
            />
          ))}
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }

  if (totalCount === 0 || users.length === 0) {
    return null;
  }

  const remainingCount = totalCount - users.length;

  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex -space-x-2">
        {users.map((user, index) => (
          <Avatar
            key={user.id}
            className="h-8 w-8 border-2 border-white dark:border-gray-900 hover:z-10 transition-transform hover:scale-110"
            style={{ zIndex: users.length - index }}
          >
            {user.imageUrl ? (
              <AvatarImage
                src={user.imageUrl}
                alt={
                  user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.username || "User"
                }
              />
            ) : null}
            <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium">
              {user.initials}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      {totalCount > 0 && (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {totalCount === 1
            ? "1 like"
            : remainingCount > 0
            ? `${totalCount} likes`
            : `${totalCount} likes`}
        </span>
      )}
    </div>
  );
}

