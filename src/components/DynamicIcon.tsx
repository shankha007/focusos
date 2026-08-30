import {
  Activity,
  AtSign,
  AudioLines,
  Award,
  BatteryLow,
  CalendarCheck,
  Circle,
  CloudDrizzle,
  CloudRain,
  Coffee,
  Crown,
  Droplets,
  Eraser,
  Eye,
  Flame,
  Footprints,
  Hand,
  Hourglass,
  Mail,
  Moon,
  PersonStanding,
  Rocket,
  ShieldCheck,
  Smartphone,
  Sparkles,
  StretchHorizontal,
  Sunrise,
  Target,
  Trees,
  Trophy,
  Users,
  Waves,
  Wind,
  Zap,
} from 'lucide-react';

/**
 * Icons referenced by name from stored data (distraction categories, sounds,
 * achievements). Registered explicitly rather than via `import * as` — a
 * namespace import of lucide-react defeats tree-shaking and drags the entire
 * ~1500-icon library into the bundle.
 */
const REGISTRY: Record<string, React.ComponentType<{ className?: string }>> = {
  Activity,
  AtSign,
  AudioLines,
  Award,
  BatteryLow,
  CalendarCheck,
  Circle,
  CloudDrizzle,
  CloudRain,
  Coffee,
  Crown,
  Droplets,
  Eraser,
  Eye,
  Flame,
  Footprints,
  Hand,
  Hourglass,
  Mail,
  Moon,
  PersonStanding,
  Rocket,
  ShieldCheck,
  Smartphone,
  Sparkles,
  StretchHorizontal,
  Sunrise,
  Target,
  Trees,
  Trophy,
  Users,
  Waves,
  Wind,
  Zap,
};

/** Renders an icon chosen by name at runtime, falling back to a plain circle when the name isn't in the registry — as happens with data written by a newer build. */
export function DynamicIcon({
  name,
  className,
  fallback: Fallback = Circle,
}: {
  name: string;
  className?: string;
  fallback?: React.ComponentType<{ className?: string }>;
}) {
  const Cmp = REGISTRY[name] ?? Fallback;
  return <Cmp className={className} />;
}
