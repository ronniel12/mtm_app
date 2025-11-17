import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardCharts from './components/DashboardCharts.vue'
import PayrollView from './components/PayrollView.vue'
import PayslipHistory from './components/PayslipHistory.vue'
import TripList from './components/TripList.vue'
import BillingView from './components/BillingView.vue'
import BillingHistory from './components/BillingHistory.vue'
import TollView from './components/TollView.vue'
import ExpensesView from './components/ExpensesView.vue'
import Maintenance from './components/Maintenance.vue'
import Settings from './components/Settings.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: DashboardCharts,
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardCharts,
  },
  {
    path: '/payroll',
    name: 'Payroll',
    component: () => import('./views/PayrollLayout.vue'), // We'll create this wrapper
    children: [
      {
        path: '',
        name: 'PayrollDefault',
        component: PayrollView,
      },
      {
        path: 'create',
        name: 'PayrollCreate',
        component: PayrollView,
      },
      {
        path: 'history',
        name: 'PayrollHistory',
        component: PayslipHistory,
      }
    ]
  },
  {
    path: '/trips',
    name: 'Trips',
    component: TripList,
  },
  {
    path: '/billing',
    name: 'Billing',
    component: () => import('./views/BillingLayout.vue'), // We'll create this wrapper
    children: [
      {
        path: '',
        name: 'BillingDefault',
        component: BillingView,
      },
      {
        path: 'create',
        name: 'BillingCreate',
        component: BillingView,
      },
      {
        path: 'history',
        name: 'BillingHistory',
        component: BillingHistory,
      }
    ]
  },
  {
    path: '/tolls',
    name: 'Tolls',
    component: TollView,
  },
  {
    path: '/expenses',
    name: 'Expenses',
    component: ExpensesView,
  },
  {
    path: '/maintenance',
    name: 'Maintenance',
    component: Maintenance,
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
  },
  {
    path: '/fuel',
    name: 'Fuel',
    component: () => import('./views/FuelView.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
