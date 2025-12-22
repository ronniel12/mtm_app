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
import AdminLogin from './views/AdminLogin.vue'
import AdminForgotPassword from './views/AdminForgotPassword.vue'
import AdminResetPassword from './views/AdminResetPassword.vue'
import UserManagement from './views/admin/UserManagement.vue'
import { useAuth } from '@/composables/useAuth'
import { useEmployeeAuth } from '@/composables/useEmployeeAuth'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: AdminLogin,
    meta: {
      title: 'Admin Login',
      guestOnly: true,
      hideShell: true,
    },
  },
  {
    path: '/admin/forgot-password',
    name: 'AdminForgotPassword',
    component: AdminForgotPassword,
    meta: {
      title: 'Forgot Password',
      guestOnly: true,
      hideShell: true,
    },
  },
  {
    path: '/admin/reset-password',
    name: 'AdminResetPassword',
    component: AdminResetPassword,
    meta: {
      title: 'Reset Password',
      guestOnly: true,
      hideShell: true,
    },
  },
  {
    path: '/admin/user-management',
    name: 'UserManagement',
    component: UserManagement,
    meta: {
      requiresAdminAuth: true,
      title: 'User Management',
    },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardCharts,
    meta: {
      requiresAdminAuth: true,
      title: 'Dashboard',
    },
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginPortal,
    meta: { 
      title: 'Employee Login Portal',
      hideShell: true,
    }
  },
  {
    path: '/employee/:pin',
    name: 'EmployeePortal',
    component: EmployeePortal,
    props: true,
    meta: { 
      requiresEmployeeAuth: true,
      title: 'Employee Portal',
      allowDirectAccess: true // Allow direct URL access for backward compatibility
    }
  },
  {
    path: '/payroll',
    name: 'Payroll',
    component: () => import('./views/PayrollLayout.vue'), // We'll create this wrapper
    meta: {
      requiresAdminAuth: true,
      title: 'Payroll',
    },
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
    meta: {
      requiresAdminAuth: true,
      title: 'Trips',
    },
  },
  {
    path: '/billing',
    name: 'Billing',
    component: () => import('./views/BillingLayout.vue'), // We'll create this wrapper
    meta: {
      requiresAdminAuth: true,
      title: 'Billing',
    },
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
    meta: {
      requiresAdminAuth: true,
      title: 'Tolls',
    },
  },
  {
    path: '/expenses',
    name: 'Expenses',
    component: ExpensesView,
    meta: {
      requiresAdminAuth: true,
      title: 'Expenses',
    },
  },
  {
    path: '/maintenance',
    name: 'Maintenance',
    component: Maintenance,
    meta: {
      requiresAdminAuth: true,
      title: 'Maintenance',
    },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
    meta: {
      requiresAdminAuth: true,
      title: 'Settings',
    },
  },
  {
    path: '/fuel',
    name: 'Fuel',
    component: () => import('./views/FuelView.vue'),
    meta: {
      requiresAdminAuth: true,
      title: 'Fuel',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// Helper functions for route permissions
function isManagerAllowed(path) {
  const managerRoutes = ['/dashboard', '/payroll', '/trips', '/billing', '/tolls', '/expenses', '/maintenance']
  return managerRoutes.some(route => path.startsWith(route))
}

function isAdminOnly(path) {
  const adminRoutes = ['/settings', '/admin/user-management']
  return adminRoutes.some(route => path.startsWith(route))
}

// Authentication guards
router.beforeEach(async (to, from, next) => {
  const adminAuth = useAuth()
  const employeeAuth = useEmployeeAuth()
  
  // Set page title
  if (to.meta.title) {
    document.title = `${to.meta.title} | MTM Enterprise`
  }
  
  if (to.meta.requiresAdminAuth) {
    await adminAuth.initializeAuth()
    if (!adminAuth.isAuthenticated.value) {
      return next({
        path: '/admin/login',
        query: { redirect: to.fullPath },
      })
    }

    // User is authenticated, check role-based permissions
    const userRole = adminAuth.user.value.role

    if (isAdminOnly(to.path)) {
      if (userRole === 'admin') {
        return next()
      } else {
        // Manager trying to access admin-only route, redirect to dashboard
        return next('/dashboard')
      }
    } else if (isManagerAllowed(to.path)) {
      // Allow authenticated users (including managers) to access these routes
      return next()
    } else {
      // For any other routes with requiresAdminAuth, allow if authenticated
      return next()
    }
  }

  if (to.meta.requiresEmployeeAuth) {
    employeeAuth.initializeAuth()
    if (employeeAuth.isAuthenticated.value) {
      return next()
    }

    if (to.meta.allowDirectAccess) {
      return next()
    }

    return next({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }

  if (to.meta.guestOnly) {
    await adminAuth.initializeAuth()
    if (adminAuth.isAuthenticated.value) {
      const redirectTarget = typeof to.query.redirect === 'string' ? to.query.redirect : '/dashboard'
      return next(redirectTarget)
    }
  }

  next()
})

// Global after hook for navigation tracking
router.afterEach((to, from) => {
  // Track navigation for analytics or debugging if needed
  console.log(`Navigation: ${from.path} -> ${to.path}`)
})

export default router
