import { useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CheckSquare,
  Command,
  LayoutDashboard,
  Maximize2,
  Pause,
  Play,
  Settings as SettingsIcon,
  Trophy,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/primitives';
import { CommandPalette } from './CommandPalette';
import { Logo, LogoMark } from '@/components/Logo';
import { useTimerStore } from '@/store/useTimerStore';
import { useHotkeys } from '@/hooks/useHotkeys';
import { cn, formatClock } from '@/lib/utils';
import { remainingMs } from '@/engine/timerEngine';
import { labelForType } from '@/engine/timerEngine';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/achievements', label: 'Progress', icon: Trophy },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

/** The frame every page renders inside: sidebar on desktop, top bar and bottom nav on mobile, a live timer readout while a session runs, and the global keyboard shortcuts. */
export function AppShell({ onOpenFocus }: { onOpenFocus: () => void }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();

  const timer = useTimerStore((s) => s.timer);
  useTimerStore((s) => s.tick);
  const toggle = useTimerStore((s) => s.toggle);

  const running = timer.status === 'running';
  const active = running || timer.status === 'paused';
  const remaining = remainingMs(timer);

  useHotkeys(
    useMemo(
      () => [
        { key: 'k', meta: true, handler: () => setPaletteOpen((v) => !v), allowInInput: true },
        { key: 'f', meta: true, shift: true, handler: onOpenFocus },
        { key: '1', meta: true, handler: () => navigate('/dashboard') },
        { key: '2', meta: true, handler: () => navigate('/tasks') },
        { key: '3', meta: true, handler: () => navigate('/analytics') },
        { key: '4', meta: true, handler: () => navigate('/achievements') },
        { key: ',', meta: true, handler: () => navigate('/settings') },
      ],
      [navigate, onOpenFocus],
    ),
  );

  return (
    <div className="flex h-full bg-bg">
      {/* Desktop sidebar */}
      <aside className="hidden w-[228px] shrink-0 flex-col border-r border-border bg-surface/50 px-3 py-4 lg:flex">
        <button
          onClick={() => navigate('/dashboard')}
          aria-label="FocusOS — go to dashboard"
          className="mb-5 flex items-center rounded-2xl px-2 py-1.5 text-left transition-colors hover:bg-elevated"
        >
          <Logo size={38} active={running} />
        </button>

        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}>
              {({ isActive }) => (
                <span
                  className={cn(
                    'relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-colors',
                    isActive ? 'text-fg' : 'text-muted hover:bg-elevated hover:text-fg',
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-xl bg-elevated"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon className="relative h-4 w-4 shrink-0" />
                  <span className="relative">{label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-2 px-1">
          {active && (
            <button
              onClick={onOpenFocus}
              className="w-full rounded-xl border border-border bg-elevated p-3 text-left transition-colors hover:border-accent/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wide text-subtle">
                  {labelForType(timer.type)}
                </span>
                <Maximize2 className="h-3 w-3 text-subtle" />
              </div>
              <p className="tabular mt-1 text-xl font-semibold tracking-tight">
                {formatClock(remaining)}
              </p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-subtle/20">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    timer.type === 'focus' ? 'bg-accent' : 'bg-break',
                  )}
                  style={{ width: `${(1 - remaining / (timer.durationMs || 1)) * 100}%` }}
                />
              </div>
            </button>
          )}

          <button
            onClick={() => setPaletteOpen(true)}
            className="flex w-full items-center gap-2 rounded-xl border border-border px-2.5 py-2 text-[12px] text-subtle transition-colors hover:border-subtle/40 hover:text-muted"
          >
            <Command className="h-3.5 w-3.5" />
            <span>Command</span>
            <kbd className="ml-auto rounded border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile / tablet top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 lg:hidden">
          <LogoMark size={30} active={running} />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">
            Focus
            <span className="bg-gradient-to-r from-accent to-break bg-clip-text text-transparent">
              OS
            </span>
          </span>

          <div className="ml-auto flex items-center gap-2">
            {active && (
              <button
                onClick={onOpenFocus}
                className="tabular flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-[13px] font-medium"
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    running ? 'animate-pulse bg-accent' : 'bg-subtle',
                  )}
                />
                {formatClock(remaining)}
              </button>
            )}
            <Button size="icon-sm" variant="ghost" onClick={() => setPaletteOpen(true)}>
              <Command className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto pb-20 lg:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="flex-1">
              {({ isActive }) => (
                <span
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors',
                    isActive ? 'text-accent' : 'text-subtle',
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Floating play control — only when a session is live */}
        {active && (
          <div className="fixed bottom-20 right-4 z-30 lg:hidden">
            <Tooltip content={running ? 'Pause' : 'Resume'}>
              <Button size="icon-lg" className="rounded-full shadow-lift" onClick={toggle}>
                {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
            </Tooltip>
          </div>
        )}
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onOpenFocus={onOpenFocus} />
    </div>
  );
}
