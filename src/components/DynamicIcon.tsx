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
