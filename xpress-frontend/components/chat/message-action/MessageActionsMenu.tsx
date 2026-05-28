import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import MessageActionsButtons from './MessageActionsButtons';
import MessageActionsPanel from './MessageActionsPanel';

interface MessageActionsMenuProps {
    isOwn: boolean;
    disabled: boolean;
    canRecall: boolean;
    isPinned?: boolean;
    isStarred?: boolean;
    onReply: () => void;
    onForward: () => void;
    onCopy: () => void;
    onPin: () => void;
    onMark: () => void;
    onSelectMany: () => void;
    onViewDetails: () => void;
    onRecall: () => void;
    onDeleteForMe: () => void;
}

export default function MessageActionsMenu({
    isOwn,
    disabled,
    canRecall,
    isPinned,
    isStarred,
    onReply,
    onForward,
    onCopy,
    onPin,
    onMark,
    onSelectMany,
    onViewDetails,
    onRecall,
    onDeleteForMe,
}: MessageActionsMenuProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuWrapperRef = useRef<HTMLDivElement | null>(null);
    const menuPanelRef = useRef<HTMLDivElement | null>(null);
    const [menuStyle, setMenuStyle] = useState<{
        top: number;
        left: number;
        maxHeight: number;
    } | null>(null);

    useEffect(() => {
        if (!menuOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            const targetNode = event.target as Node;
            if (menuWrapperRef.current?.contains(targetNode)) return;
            if (menuPanelRef.current?.contains(targetNode)) return;
            setMenuOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    useLayoutEffect(() => {
        if (!menuOpen) return;

        const updatePosition = () => {
            const wrapper = menuWrapperRef.current;
            const panel = menuPanelRef.current;
            if (!wrapper) return;

            const trigger = wrapper.querySelector('button[aria-label="Mở menu tin nhắn"]') as HTMLButtonElement | null;
            if (!trigger) return;

            const rect = trigger.getBoundingClientRect();
            const scrollContainer = wrapper.closest('[data-chat-scroll="true"]') as HTMLElement | null;
            const boundary = scrollContainer?.getBoundingClientRect();
            const menuWidth = 224;
            const boundaryPadding = 12;
            const spacing = 12;
            const menuHeight = panel?.getBoundingClientRect().height ?? 280;

            const boundaryTop = boundary?.top ?? 0;
            const boundaryBottom = boundary?.bottom ?? window.innerHeight;
            const boundaryLeft = boundary?.left ?? 0;
            const boundaryRight = boundary?.right ?? window.innerWidth;

            const spaceBelow = boundaryBottom - rect.bottom - boundaryPadding;
            const spaceAbove = rect.top - boundaryTop - boundaryPadding;
            const openUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow;

            const left = isOwn
                ? Math.max(boundaryLeft + boundaryPadding, Math.min(rect.right - menuWidth, boundaryRight - menuWidth - boundaryPadding))
                : Math.max(boundaryLeft + boundaryPadding, Math.min(rect.left, boundaryRight - menuWidth - boundaryPadding));

            const rawTop = openUpward
                ? rect.top - spacing - menuHeight
                : rect.bottom + spacing;

            const top = Math.max(
                boundaryTop + boundaryPadding,
                Math.min(rawTop, boundaryBottom - boundaryPadding - menuHeight),
            );

            setMenuStyle({
                top,
                left,
                maxHeight: Math.max(160, Math.min(menuHeight, boundaryBottom - boundaryTop - boundaryPadding * 2)),
            });
        };

        updatePosition();

        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOwn, menuOpen]);

    if (disabled) {
        return null;
    }

    return (
        <div className="relative" ref={menuWrapperRef}>
            <MessageActionsButtons
                menuOpen={menuOpen}
                onReply={onReply}
                onForward={onForward}
                onMenuToggle={() => setMenuOpen((prev) => !prev)}
            />

            {menuOpen && menuStyle && typeof document !== 'undefined'
                ? createPortal(
                    <MessageActionsPanel
                        isOwn={isOwn}
                        canRecall={canRecall}
                        isPinned={isPinned}
                        isStarred={isStarred}
                        onCopy={onCopy}
                        onPin={onPin}
                        onMark={onMark}
                        onSelectMany={onSelectMany}
                        onViewDetails={onViewDetails}
                        onRecall={onRecall}
                        onDeleteForMe={onDeleteForMe}
                        onClose={() => setMenuOpen(false)}
                        style={menuStyle}
                        panelRef={menuPanelRef}
                    />,
                    document.body,
                )
                : null}
        </div>
    );
}