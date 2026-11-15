'use client';

import React from 'react';

interface FormattedMessageTextProps {
  text: string;
  className?: string;
  linkClassName?: string;
}

export function FormattedMessageText({
  text,
  className = '',
  linkClassName = 'text-sky-500 hover:text-sky-400 underline underline-offset-2 break-all transition-colors duration-150 font-medium',
}: FormattedMessageTextProps) {
  if (!text) return null;

  // Pattern matches:
  // 1. Markdown link: [Label](url)
  // 2. HTTP/HTTPS URLs: https?://[^\s]+
  // 3. Telegram links: (?:https?:\/\/)?t\.me\/[a-zA-Z0-9_]+
  // 4. Usernames: @[a-zA-Z0-9_]{3,32}
  const tokenRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s]+|(?:^|\s)(?:t\.me\/[a-zA-Z0-9_+\-]+)|(?:^|\s)(?:@[a-zA-Z0-9_]{3,32}))/g;

  // Split text into tokens while preserving delimiters
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchString = match[0];

    // Push plain text prior to the match
    if (matchStart > lastIndex) {
      elements.push(text.slice(lastIndex, matchStart));
    }

    if (match[2] && match[3]) {
      // Markdown link: [label](url)
      const label = match[2];
      const url = match[3];
      elements.push(
        <a
          key={`md-${matchStart}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
          onClick={(e) => e.stopPropagation()}
        >
          {label}
          <span className="inline-block text-[10px] ml-0.5 opacity-70">↗</span>
        </a>
      );
    } else if (matchString.trim().startsWith('http://') || matchString.trim().startsWith('https://')) {
      // Raw URL
      const rawUrl = matchString.trim();
      // Clean trailing punctuation
      const cleanUrl = rawUrl.replace(/[.,!?;:)\]]+$/, '');
      const trailing = rawUrl.slice(cleanUrl.length);

      elements.push(
        <React.Fragment key={`url-${matchStart}`}>
          <a
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
            onClick={(e) => e.stopPropagation()}
          >
            {cleanUrl}
            <span className="inline-block text-[10px] ml-0.5 opacity-70">↗</span>
          </a>
          {trailing}
        </React.Fragment>
      );
    } else if (matchString.includes('t.me/')) {
      // Telegram short link like t.me/channel
      const leadSpace = matchString.startsWith(' ') ? ' ' : '';
      const trimmed = matchString.trim();
      const cleanUrl = trimmed.replace(/[.,!?;:)\]]+$/, '');
      const trailing = trimmed.slice(cleanUrl.length);
      const fullUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;

      elements.push(
        <React.Fragment key={`tme-${matchStart}`}>
          {leadSpace}
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
            onClick={(e) => e.stopPropagation()}
          >
            {cleanUrl}
            <span className="inline-block text-[10px] ml-0.5 opacity-70">↗</span>
          </a>
          {trailing}
        </React.Fragment>
      );
    } else if (matchString.includes('@')) {
      // Telegram @mention
      const leadSpace = matchString.startsWith(' ') ? ' ' : '';
      const trimmed = matchString.trim();
      const username = trimmed.replace(/^@/, '');
      const fullUrl = `https://t.me/${username}`;

      elements.push(
        <React.Fragment key={`mention-${matchStart}`}>
          {leadSpace}
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClassName}
            onClick={(e) => e.stopPropagation()}
          >
            {trimmed}
          </a>
        </React.Fragment>
      );
    } else {
      elements.push(matchString);
    }

    lastIndex = matchStart + matchString.length;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return (
    <span className={`whitespace-pre-wrap break-words leading-relaxed ${className}`}>
      {elements}
    </span>
  );
}
