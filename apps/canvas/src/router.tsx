import { createHashRouter, Navigate, Outlet } from 'react-router-dom';
import { AgentPanel } from '@/components/agent/agent-panel';
import { AppConfigModal } from '@/components/layout/app-config-modal';
import CanvasPage from '@/pages/canvas';
import CanvasProjectPage from '@/pages/canvas/project';

export const router = createHashRouter([{
  element: <div className="flex h-dvh overflow-hidden bg-background text-foreground"><div className="min-w-0 flex-1 overflow-hidden"><Outlet /></div><AgentPanel /><AppConfigModal /></div>,
  children: [
    { path: '/', element: <Navigate to="/canvas" replace /> },
    { path: '/canvas', element: <CanvasPage /> },
    { path: '/canvas/:id', element: <CanvasProjectPage /> },
    { path: '*', element: <Navigate to="/canvas" replace /> },
  ],
}]);
