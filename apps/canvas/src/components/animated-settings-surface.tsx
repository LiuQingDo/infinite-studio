import { type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export function AnimatedSettingsSurface({ open, panelRef, style, topPlacement, children }: {
    open: boolean;
    panelRef: RefObject<HTMLDivElement | null>;
    style: CSSProperties;
    topPlacement?: boolean;
    children: ReactNode;
}) {
    const reduced = useReducedMotion();
    return createPortal(
        <AnimatePresence>
            {open && <motion.div
                key="settings"
                ref={panelRef}
                role="dialog"
                aria-label="生成参数设置"
                className="canvas-image-settings-popover canvas-settings-surface"
                style={{ ...style, width: Math.min(Number(style.width) || 356, window.innerWidth - 24), maxHeight: Math.min(Number(style.maxHeight) || window.innerHeight - 24, window.innerHeight - 24), overflowY: "auto", transformOrigin: topPlacement ? "left bottom" : "left top" }}
                initial={{ opacity: 0, scale: reduced ? 1 : 0.97, y: reduced ? 0 : topPlacement ? 6 : -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: reduced ? 1 : 0.97, y: reduced ? 0 : topPlacement ? 4 : -4 }}
                transition={{ duration: reduced ? 0 : 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
            >{children}</motion.div>}
        </AnimatePresence>, document.body,
    );
}
