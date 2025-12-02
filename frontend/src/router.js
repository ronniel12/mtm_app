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
import EmployeePortal from './views/EmployeePortal.vue'
import LoginPortal from './views/LoginPortal.vue'
import { useAuth } from '@/composables/useAuth'

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
    path: '/login',
    name: 'Login',
    component: LoginPortal,
    meta: { 
      requiresAuth: false,
      title: 'Employee Login Portal'
    }
  },
  {
    path: '/employee/:pin',
    name: 'EmployeePortal',
    component: EmployeePortal,
    props: true,
    meta: { 
      requiresAuth: true,
      title: 'Employee Portal',
      allowDirectAccess: true // Allow direct URL access for backward compatibility
    }
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

// Authentication guards
router.beforeEach(async (to, from, next) => {
  const { initializeAuth, isAuthenticated } = useAuth()
  
  // Initialize authentication state
  const authInitialized = initializeAuth()
  
  // Set page title
  if (to.meta.title) {
    document.title = `${to.meta.title} | MTM Enterprise`
  }
  
  // Check if route requires authentication
  if (to.meta.requiresAuth) {
    // For employee portal, allow direct access but redirect if not authenticated
    if (to.name === 'EmployeePortal') {
      const auth = useAuth()
      
      if (auth.isAuthenticated.value) {
        // User is authenticated, allow access
        next()
      } else if (to.meta.allowDirectAccess) {
        // Allow direct access for backward compatibility
        // Check if PIN matches current user session
        const routePin = to.params.pin
        
        if (routePin && /^\d{4}$/.test(routePin)) {
          // Allow direct access to employee portal with valid PIN
          // The component itself will handle the authentication
          next()
        } else {
          // Invalid PIN format, redirect to login
          next('/login')
        }
      } else {
        // Not authenticated and no direct access allowed, redirect to login
        next('/login')
      }
    } else {
      // Other protected routes
      if (isAuthenticated.value) {
        next()
      } else {
        // Redirect to login with return URL
        next({
          path: '/login',
          query: { redirect: to.fullPath }
        })
      }
    }
  } else {
    // Route doesn't require authentication
    // Allow access to login page even if authenticated - users can manually access it
    next()
  }
})

// Global after hook for navigation tracking
router.afterEach((to, from) => {
  // Track navigation for analytics or debugging if needed
})

export default router
