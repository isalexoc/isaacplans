"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { type SupportedLocale } from "@/lib/seo/i18n";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/lib/image";
import type { SanityDocument } from "next-sanity";

interface SearchResult {
  _id: string;
  title: string;
  slug: { current: string };
  excerpt?: string;
  image?: any;
  category?: string;
  publishedAt: string;
}

interface BlogSearchProps {
  locale: SupportedLocale;
}

const CATEGORY_LABELS: Record<string, { en: string; es: string }> = {
  'aca': { en: 'ACA / Obamacare', es: 'ACA / Obamacare' },
  'short-term-medical': { en: 'Short Term Medical', es: 'Seguro Médico de Corto Plazo' },
  'dental-vision': { en: 'Dental & Vision', es: 'Dental y Visión' },
  'hospital-indemnity': { en: 'Hospital Indemnity', es: 'Indemnización Hospitalaria' },
  'iul': { en: 'IUL', es: 'IUL' },
  'final-expense': { en: 'Final Expense', es: 'Gastos Finales' },
  'cancer-plans': { en: 'Cancer Plans', es: 'Planes de Cáncer' },
  'heart-stroke': { en: 'Heart & Stroke', es: 'Corazón y Derrame' },
  'general': { en: 'General Insurance', es: 'Seguro General' },
  'tips-guides': { en: 'Tips & Guides', es: 'Consejos y Guías' },
  'news': { en: 'Industry News', es: 'Noticias de la Industria' },
};

export function BlogSearch({ locale }: BlogSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Debounced search function
  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/blog/search?q=${encodeURIComponent(searchQuery)}&locale=${locale}&limit=5`
        );

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = await response.json();
        setResults(data.posts || []);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [locale]
  );

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(-1);

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Show dropdown if there's a query
    if (value.trim().length >= 2) {
      setIsOpen(true);
      // Debounce: wait 300ms after user stops typing
      timeoutRef.current = setTimeout(() => {
        performSearch(value);
      }, 300);
    } else {
      setIsOpen(false);
      setResults([]);
    }
  };

  // Handle form submission - navigate to search results page
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 2) {
      setIsOpen(false);
      router.push(`/${locale}/blog/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "Enter" && query.trim().length >= 2) {
        handleSubmit(e);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          const result = results[selectedIndex];
          router.push(`/${locale}/blog/${result.slug.current}`);
          setIsOpen(false);
        } else {
          handleSubmit(e);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const searchPlaceholder =
    locale === "en"
      ? "Search blog posts..."
      : "Buscar publicaciones...";

  const viewAllText =
    locale === "en" ? "View all results" : "Ver todos los resultados";
  const noResultsText =
    locale === "en" ? "No results found" : "No se encontraron resultados";

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (query.trim().length >= 2 && results.length > 0) {
                setIsOpen(true);
              }
            }}
            placeholder={searchPlaceholder}
            className="pl-10 pr-10 w-full"
            aria-label={searchPlaceholder}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label={locale === "en" ? "Clear search" : "Limpiar búsqueda"}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Dropdown Results */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : results.length > 0 ? (
              <>
                <div role="listbox">
                  {results.map((post, index) => {
                    const imageUrl = post.image
                      ? urlFor(post.image).width(80).height(80).fit('crop').url()
                      : null;
                    const categoryLabel =
                      post.category
                        ? CATEGORY_LABELS[post.category]?.[locale] || post.category
                        : null;

                    return (
                      <Link
                        key={post._id}
                        href={`/${locale}/blog/${post.slug.current}`}
                        onClick={() => setIsOpen(false)}
                        className={`block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          index === selectedIndex
                            ? "bg-gray-50 dark:bg-gray-700"
                            : ""
                        }`}
                        role="option"
                        aria-selected={index === selectedIndex}
                      >
                        <div className="flex gap-3">
                          {imageUrl && (
                            <div className="relative w-16 h-16 flex-shrink-0 rounded overflow-hidden">
                              <Image
                                src={imageUrl}
                                alt={post.title}
                                fill
                                className="object-cover"
                                sizes="64px"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            {categoryLabel && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                {categoryLabel}
                              </span>
                            )}
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1 mt-1">
                              {post.title}
                            </h3>
                            {post.excerpt && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                                {post.excerpt}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="w-full px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
                  >
                    {viewAllText} ({results.length}+)
                  </button>
                </div>
              </>
            ) : query.trim().length >= 2 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-400">
                {noResultsText}
              </div>
            ) : null}
          </div>
        )}
      </form>
    </div>
  );
}
