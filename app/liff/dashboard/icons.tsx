import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Award,
  CalendarClock,
  Cat,
  Activity,
  HandCoins,
  LineChart,
  HandHelping,
  History,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  Settings,
  Star,
  Tag,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type TabKey = "overview" | "history" | "debts" | "bills" | "settings";

export const TAB_ICONS: Record<TabKey, LucideIcon> = {
  overview: LayoutDashboard,
  history: History,
  debts: HandCoins,
  bills: CalendarClock,
  settings: Settings,
};

export const TX_ICONS: Record<string, LucideIcon> = {
  INCOME: ArrowDownLeft,
  EXPENSE: ArrowUpRight,
  TRANSFER: ArrowLeftRight,
  DEBT_LEND: HandHelping,
  DEBT_REPAY: ArrowDownLeft,
};

export const ACCOUNT_ICONS: Record<string, LucideIcon> = {
  WALLET: Wallet,
  SAVINGS: Landmark,
  INVESTMENT: LineChart,
  CREDIT: Receipt,
};

type CpIconProps = {
  icon: LucideIcon;
  size?: number;
  color?: string;
  className?: string;
  strokeWidth?: number;
};

export function CpIcon({ icon: Icon, size = 18, color, className, strokeWidth = 1.75 }: CpIconProps) {
  return (
    <Icon
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden
    />
  );
}

export {
  Activity,
  Award,
  Cat,
  PiggyBank,
  Receipt,
  Star,
  Tag,
  TrendingDown,
  TrendingUp,
  Wallet,
};
