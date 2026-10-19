import { html } from "@daevsoft/jetz";

// UI chrome — Lucide (PascalCase SVG-string exports from lucide-static).
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Settings,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  PiggyBank,
  CreditCard,
  Lightbulb,
  CirclePlus,
  ChevronRight,
  Pencil,
  Trash2,
  X,
  Plus,
  Minus,
  Download,
  Sheet,
  Landmark,
  ArrowRightLeft,
  AlarmClock,
  Bell,
  CircleCheck,
  Upload,
  Dices,
  Sun,
  Moon,
  Trophy,
  ReceiptText,
  BarChart3,
  TriangleAlert,
  Tag,
  Menu,
  TrendingUp,
  TrendingDown,
} from "lucide-static";

// Category icons — Tabler (raw outline SVGs, bundled as strings).
import briefcase from "@tabler/icons/outline/briefcase.svg";
import toolsKitchen2 from "@tabler/icons/outline/tools-kitchen-2.svg";
import shoppingCart from "@tabler/icons/outline/shopping-cart.svg";
import car from "@tabler/icons/outline/car.svg";
import movie from "@tabler/icons/outline/movie.svg";
import receipt2 from "@tabler/icons/outline/receipt-2.svg";
import pill from "@tabler/icons/outline/pill.svg";
import pkg from "@tabler/icons/outline/package.svg";
// Account kinds — Tabler.
import wallet from "@tabler/icons/outline/wallet.svg";
import buildingBank from "@tabler/icons/outline/building-bank.svg";
import deviceMobile from "@tabler/icons/outline/device-mobile.svg";
import coins from "@tabler/icons/outline/coins.svg";

// Icon SVGs ship with width/height="24"; the wrapper span owns the size and
// `currentColor` carries text color into the strokes.
const fitSize = svg =>
  svg.replace(/\swidth="24"/, ' width="100%"').replace(/\sheight="24"/, ' height="100%"');

// Returns a Jetz Raw node — use it as an element child.
export const Icon = (svg, cls = "h-4 w-4") =>
  html(`<span class="inline-flex shrink-0 items-center justify-center ${cls}">${fitSize(svg)}</span>`);

export const UI = {
  dashboard: LayoutDashboard,
  transactions: ArrowLeftRight,
  budgets: Target,
  settings: Settings,
  wallet: Wallet,
  income: ArrowDownToLine,
  expense: ArrowUpFromLine,
  savings: PiggyBank,
  card: CreditCard,
  insight: Lightbulb,
  add: CirclePlus,
  chevron: ChevronRight,
  pencil: Pencil,
  trash: Trash2,
  close: X,
  plus: Plus,
  minus: Minus,
  download: Download,
  sheet: Sheet,
  bank: Landmark,
  transfer: ArrowRightLeft,
  remind: AlarmClock,
  bell: Bell,
  check: CircleCheck,
  upload: Upload,
  dices: Dices,
  sun: Sun,
  moon: Moon,
  trophy: Trophy,
  receipt: ReceiptText,
  chart: BarChart3,
  alert: TriangleAlert,
  tags: Tag,
  menu: Menu,
  trendUp: TrendingUp,
  trendDown: TrendingDown,
};

// Keyed by the `icon` field in src/data/categories.json (Tabler icon names).
export const CATEGORY_ICONS = {
  briefcase,
  "tools-kitchen-2": toolsKitchen2,
  "shopping-cart": shoppingCart,
  car,
  movie,
  "receipt-2": receipt2,
  pill,
  package: pkg,
};

export const CategoryIcon = (category, cls = "h-3.5 w-3.5") =>
  Icon(CATEGORY_ICONS[category?.icon] || pkg, cls);

// Keyed by the `icon` field in src/data/accounts.json (Tabler icon names).
export const ACCOUNT_ICONS = {
  wallet,
  "building-bank": buildingBank,
  "device-mobile": deviceMobile,
  coins,
  package: pkg,
};

export const AccountIcon = (account, cls = "h-4 w-4") =>
  Icon(ACCOUNT_ICONS[account?.icon] || pkg, cls);
