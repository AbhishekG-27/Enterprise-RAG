'use client';

import { useState, useEffect } from 'react';

interface RelativeTimestampProps {
  dateString: string;
  className?: string;
  autoRefresh?: boolean; // Optional: refresh every minute
}

export default function RelativeTimestamp({
  dateString,
  className = '',
  autoRefresh = false
}: RelativeTimestampProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [, setTick] = useState(0); // Force re-render for auto-refresh

  // Set mounted after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Optional: Refresh timestamp every minute
  useEffect(() => {
    if (!autoRefresh || !isMounted) return;

    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, isMounted]);

  // Parse timestamp and ensure UTC interpretation
  const parseTimestamp = (dateStr: string): Date => {
    // If timestamp already has 'Z' suffix, use as-is
    if (dateStr.endsWith('Z')) {
      return new Date(dateStr);
    }
    // For old format without 'Z', append it to force UTC interpretation
    return new Date(dateStr + 'Z');
  };

  // Static date formatting for SSR
  const formatStaticDate = (dateStr: string) => {
    const date = parseTimestamp(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  // Relative date formatting for client
  const formatRelativeDate = (dateStr: string) => {
    const date = parseTimestamp(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Render static date during SSR, relative time after mount
  const displayText = isMounted
    ? formatRelativeDate(dateString)
    : formatStaticDate(dateString);

  return <span className={className}>{displayText}</span>;
}
