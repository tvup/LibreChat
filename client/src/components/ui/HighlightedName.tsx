import React from 'react';

export default function HighlightedName({
  name,
  preferredName,
  className,
}: {
  name: string;
  preferredName?: string;
  className?: string;
}) {
  if (!preferredName || !name.includes(preferredName)) {
    return <span className={className}>{name}</span>;
  }

  const parts = name.split(new RegExp(`(${preferredName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g'));

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part === preferredName ? (
          <span key={i} className="underline decoration-2 underline-offset-2">
            {part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </span>
  );
}
