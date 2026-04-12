interface ComposerToolbarProps {
  onOpenImagePicker: () => void;
  onOpenFilePicker: () => void;
}

const toolbarItems = [
  'sticker',
  'image',
  'attach',
  'card',
  'crop',
  'format',
  'lightning',
  'note',
  'more',
] as const;

function ToolbarIcon({ item }: { item: (typeof toolbarItems)[number] }) {
  if (item === 'sticker') {
    return (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <circle cx="10" cy="11" r="1" fill="currentColor" />
        <circle cx="14" cy="11" r="1" fill="currentColor" />
        <path d="M9 15c1 .7 2 .9 3 .9s2-.2 3-.9" />
      </svg>
    );
  }

  if (item === 'image') {
    return (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.2" fill="currentColor" />
        <path d="m21 15-4.5-4.5L7 20" />
      </svg>
    );
  }

  if (item === 'attach') {
    return (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m10 13 5.6-5.6a3 3 0 1 1 4.2 4.2L12 19.4a5 5 0 1 1-7.1-7.1l8.3-8.3" />
      </svg>
    );
  }

  if (item === 'card') {
    return (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 11h10" />
        <path d="M7 15h4" />
      </svg>
    );
  }

  if (item === 'crop') {
    return (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 4v12a4 4 0 0 0 4 4h8" />
        <path d="M4 8h12a4 4 0 0 1 4 4v8" />
      </svg>
    );
  }

  if (item === 'format') {
    return (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m6 19 6-14 6 14" />
        <path d="M8.5 13h7" />
      </svg>
    );
  }

  if (item === 'lightning') {
    return (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m13 3-7 9h5l-1 9 7-10h-5l1-8Z" />
      </svg>
    );
  }

  if (item === 'note') {
    return (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor">
      <circle cx="7" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="17" cy="12" r="1.5" />
    </svg>
  );
}

export default function ComposerToolbar({ onOpenImagePicker, onOpenFilePicker }: ComposerToolbarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-[#d8dce2] px-3 py-2 text-[#0d2b5a]">
      {toolbarItems.map((item) => (
        <button
          key={item}
          type="button"
          onClick={item === 'image' ? onOpenImagePicker : item === 'attach' ? onOpenFilePicker : undefined}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-zinc-100"
          aria-label={item}
        >
          <ToolbarIcon item={item} />
        </button>
      ))}
    </div>
  );
}
