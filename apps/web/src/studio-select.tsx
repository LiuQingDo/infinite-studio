import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Cpu } from 'lucide-react';
import './studio-select.css';

type Option = { value: string; label: string; description?: string };
type Props = { label: string; value: string; onChange: (value: string) => void; options: Option[]; layout?: 'list' | 'segments' | 'ratios' };

export function StudioSelect({ label, value, onChange, options, layout = 'list' }: Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const selected = options.find(option => option.value === value);
  const positioned = position !== null;

  useLayoutEffect(() => {
    if (open && positioned) popup.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus({ preventScroll: true });
  }, [open, positioned]);

  useEffect(() => {
    if (!open) return;
    const positionPopup = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(layout === 'list' ? 310 : layout === 'ratios' ? 330 : 270, window.innerWidth - 24);
      const above = rect.top > window.innerHeight - rect.bottom;
      const available = Math.max(80, (above ? rect.top : window.innerHeight - rect.bottom) - 24);
      setPosition({ width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        ...(above ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
        maxHeight: available, transformOrigin: above ? 'left bottom' : 'left top' });
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !trigger.current?.contains(event.target) && !popup.current?.contains(event.target)) setOpen(false);
    };
    const closeOthers = (event: Event) => { if ((event as CustomEvent).detail !== id) setOpen(false); };
    positionPopup();
    window.addEventListener('pointerdown', outside);
    window.addEventListener('studio-select-open', closeOthers);
    window.addEventListener('resize', positionPopup);
    window.addEventListener('scroll', positionPopup, true);
    return () => {
      window.removeEventListener('pointerdown', outside);
      window.removeEventListener('studio-select-open', closeOthers);
      window.removeEventListener('resize', positionPopup);
      window.removeEventListener('scroll', positionPopup, true);
    };
  }, [open, id, layout]);

  function toggle() {
    if (!open) window.dispatchEvent(new CustomEvent('studio-select-open', { detail: id }));
    setOpen(!open);
  }
  return <>
    <button ref={trigger} type="button" className="studio-select-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`}
      onClick={toggle} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (!open) toggle(); } }}>
      {layout === 'list' && <Cpu size={14}/>}<span>{selected?.label ?? value}</span><ChevronDown size={12}/>
    </button>
    {position && createPortal(<div ref={popup} className={`studio-select-popup ${open ? 'is-open' : ''}`} style={position} inert={!open} aria-hidden={!open}>
      <div className="studio-select-heading">{label}</div>
      <div id={`${id}-list`} role="listbox" aria-label={label} className={`studio-select-options layout-${layout}`} onKeyDown={event => {
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]'));
        const current = items.indexOf(document.activeElement as HTMLElement);
        const direction = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 0;
        if (direction || event.key === 'Home' || event.key === 'End') {
          event.preventDefault(); items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + direction + items.length) % items.length]?.focus();
        }
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
        if (event.key === 'Tab') { setOpen(false); trigger.current?.focus(); }
      }}>
        {options.map(option => <button key={option.value} type="button" role="option" aria-selected={value === option.value} tabIndex={-1}
          className="studio-select-option" onClick={() => { onChange(option.value); setOpen(false); trigger.current?.focus(); }}>
          {layout === 'list' && <span className="studio-select-model-icon"><Cpu size={19}/></span>}
          {layout === 'ratios' && <span className="studio-ratio-icon" style={{ aspectRatio: option.value.replace(':', '/'), width: Number(option.value.split(':')[0]) > Number(option.value.split(':')[1]) ? 20 : undefined, height: Number(option.value.split(':')[0]) <= Number(option.value.split(':')[1]) ? 20 : undefined }}/>} 
          <span className="studio-select-copy"><span>{option.label}</span>{option.description && <small>{option.description}</small>}</span>
          {layout === 'list' && value === option.value && <Check size={16} className="studio-select-check"/>}
        </button>)}
      </div>
    </div>, document.body)}
  </>;
}
