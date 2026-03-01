import {
  Home,
  Map,
  Route,
  AlertCircle,
  BarChart3,
  Brain,
  MapPin,
  Trophy,
  Package,
  Calendar,
  Users,
  ShieldAlert,
} from 'lucide-react';

export interface NavItem {
  key: string;
  title: string;
  path?: string;
  icon?: React.ReactNode;
  children: NavItem[];
}

export const sidebarNavItems: NavItem[] = [
  {
    key: 'pulse',
    title: 'The Pulse',
    icon: null,
    children: [
      {
        path: '/',
        key: 'home',
        title: 'Home',
        icon: <Home className="w-5 h-5" />,
        children: [],
      },
    ],
  },
  {
    key: 'operations',
    title: 'Operations',
    icon: null,
    children: [
      {
        path: '/operations/live-map',
        key: 'live-map',
        title: 'Live Map',
        icon: <Map className="w-5 h-5" />,
        children: [],
      },
      {
        path: '/operations/routes',
        key: 'routes',
        title: 'Routes',
        icon: <Route className="w-5 h-5" />,
        children: [],
      },
      {
        path: '/operations/shifts',
        key: 'shifts',
        title: 'Shifts',
        icon: <Calendar className="w-5 h-5" />,
        children: [],
      },
      {
        path: '/operations/issues',
        key: 'issues',
        title: 'Issues & Alerts',
        icon: <AlertCircle className="w-5 h-5" />,
        children: [],
      },
      {
        path: '/operations/no-go-zones',
        key: 'no-go-zones',
        title: 'No-Go Zones',
        icon: <ShieldAlert className="w-5 h-5" />,
        children: [],
      },
    ],
  },
  {
    key: 'intelligence',
    title: 'Intelligence',
    icon: null,
    children: [
      {
        path: '/intelligence/analytics',
        key: 'analytics',
        title: 'Analytics',
        icon: <BarChart3 className="w-5 h-5" />,
        children: [],
      },
      {
        path: '/intelligence/predictive',
        key: 'predictive',
        title: 'Predictive Insights',
        icon: <Brain className="w-5 h-5" />,
        children: [],
      },
      {
        path: '/intelligence/planner',
        key: 'planner',
        title: 'Expansion Planner',
        icon: <MapPin className="w-5 h-5" />,
        children: [],
      },
      {
        path: '/intelligence/leaderboard',
        key: 'leaderboard',
        title: 'Driver Leaderboard',
        icon: <Trophy className="w-5 h-5" />,
        children: [],
      },
    ],
  },
  {
    key: 'administration',
    title: 'Administration',
    icon: null,
    children: [
      {
        path: '/administration/inventory',
        key: 'inventory',
        title: 'Inventory',
        icon: <Package className="w-5 h-5" />,
        children: [],
      },
      {
        path: '/administration/team',
        key: 'team',
        title: 'Team',
        icon: <Users className="w-5 h-5" />,
        children: [],
      },
    ],
  },
];
