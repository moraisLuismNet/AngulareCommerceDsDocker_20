import { inject } from '@angular/core';
import { Routes, RouterModule, Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { AuthGuard } from './guards/AuthGuardService';

export const canActivate = () => {
  const guard = inject(AuthGuard);
  if (!guard.isLoggedIn()) {
    const router = inject(Router);
    router.navigate(['/login']);
    return false;
  }
  return true;
};

export const appRoutes: Routes = [
  // Public routes
  { 
    path: 'login', 
    loadComponent: () => import('./shared/login/LoginComponent').then(m => m.LoginComponent) 
  },
  { 
    path: 'register', 
    loadComponent: () => import('./shared/register/RegisterComponent').then(m => m.RegisterComponent) 
  },
  { 
    path: 'listrecords/:idGroup', 
    loadComponent: () => import('./ecommerce/listrecords/ListrecordsComponent').then(m => m.ListrecordsComponent) 
  },
  { 
    path: 'cart-details', 
    loadComponent: () => import('./ecommerce/CartDetails/CartDetailsComponent').then(m => m.CartDetailsComponent) 
  },
  
  // Ecommerce routes with lazy loading
  {
    path: '',
    loadComponent: () => import('./ecommerce/EcommerceComponent').then(m => m.EcommerceComponent),
    children: [
      { 
        path: '', 
        loadComponent: () => import('./ecommerce/listgroups/ListgroupsComponent').then(m => m.ListgroupsComponent) 
      },
      { 
        path: 'listrecords/:idGroup', 
        loadComponent: () => import('./ecommerce/listrecords/ListrecordsComponent').then(m => m.ListrecordsComponent) 
      },
      { 
        path: 'listgroups', 
        loadComponent: () => import('./ecommerce/listgroups/ListgroupsComponent').then(m => m.ListgroupsComponent) 
      },
      { 
        path: 'genres', 
        loadComponent: () => import('./ecommerce/genres/GenresComponent').then(m => m.GenresComponent),
        canActivate: [canActivate]
      },
      { 
        path: 'groups', 
        loadComponent: () => import('./ecommerce/groups/GroupsComponent').then(m => m.GroupsComponent),
        canActivate: [canActivate]
      },
      { 
        path: 'records', 
        loadComponent: () => import('./ecommerce/records/RecordsComponent').then(m => m.RecordsComponent),
        canActivate: [canActivate]
      },
      { 
        path: 'cart-details', 
        loadComponent: () => import('./ecommerce/CartDetails/CartDetailsComponent').then(m => m.CartDetailsComponent) 
      },
      { 
        path: 'carts', 
        loadComponent: () => import('./ecommerce/carts/CartsComponent').then(m => m.CartsComponent) 
      },
      { 
        path: 'orders', 
        loadComponent: () => import('./ecommerce/orders/OrdersComponent').then(m => m.OrdersComponent),
        canActivate: [canActivate]
      },
      { 
        path: 'admin-orders', 
        loadComponent: () => import('./ecommerce/AdminOrders/AdminOrdersComponent').then(m => m.AdminOrdersComponent),
        canActivate: [canActivate]
      },
      { 
        path: 'users', 
        loadComponent: () => import('./ecommerce/users/UsersComponent').then(m => m.UsersComponent),
        canActivate: [canActivate]
      },
    ]
  },
  { path: '**', redirectTo: '' }
];

// Application configuration with router setup
export const appConfig = {
  providers: [
    provideRouter(appRoutes, withComponentInputBinding())
  ]
};

// Export the routes for standalone bootstrap
export const AppRoutingModule = RouterModule.forRoot(appRoutes);
