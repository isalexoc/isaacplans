"use client";

import Link from "next/link";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { type SupportedLocale } from "@/lib/seo/i18n";

interface BlogPaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  locale: SupportedLocale;
}

export function BlogPagination({
  currentPage,
  totalPages,
  baseUrl,
  locale,
}: BlogPaginationProps) {
  // Don't render if only one page
  if (totalPages <= 1) {
    return null;
  }

  const getPageUrl = (page: number) => {
    if (page === 1) {
      return baseUrl;
    }
    // Check if baseUrl already has query parameters
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}page=${page}`;
  };

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 7; // Show up to 7 page numbers

    if (totalPages <= maxVisible) {
      // Show all pages if total is less than max
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage <= 3) {
        // Near the beginning: 1, 2, 3, 4, ..., last
        for (let i = 2; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near the end: 1, ..., last-3, last-2, last-1, last
        pages.push("ellipsis");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle: 1, ..., current-1, current, current+1, ..., last
        pages.push("ellipsis");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();
  const prevText = locale === "en" ? "Previous" : "Anterior";
  const nextText = locale === "en" ? "Next" : "Siguiente";

  return (
    <Pagination className="mt-12">
      <PaginationContent>
        {/* Previous Button */}
        {currentPage > 1 ? (
          <PaginationItem>
            <PaginationPrevious href={getPageUrl(currentPage - 1)}>
              {prevText}
            </PaginationPrevious>
          </PaginationItem>
        ) : (
          <PaginationItem>
            <PaginationPrevious href="#" className="pointer-events-none opacity-50">
              {prevText}
            </PaginationPrevious>
          </PaginationItem>
        )}

        {/* Page Numbers */}
        {pageNumbers.map((page, index) => {
          if (page === "ellipsis") {
            return (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            );
          }

          return (
            <PaginationItem key={page}>
              <PaginationLink
                href={getPageUrl(page)}
                isActive={page === currentPage}
                aria-label={`Go to page ${page}`}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          );
        })}

        {/* Next Button */}
        {currentPage < totalPages ? (
          <PaginationItem>
            <PaginationNext href={getPageUrl(currentPage + 1)}>
              {nextText}
            </PaginationNext>
          </PaginationItem>
        ) : (
          <PaginationItem>
            <PaginationNext href="#" className="pointer-events-none opacity-50">
              {nextText}
            </PaginationNext>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
