import { Component, OnInit, ChangeDetectorRef, afterNextRender, DestroyRef, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { BadgeModule } from 'primeng/badge';
import { RippleModule } from 'primeng/ripple';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { UserService } from 'src/app/services/UserService';
import { CartService } from 'src/app/ecommerce/services/CartService';

@Component({
    selector: 'app-navbar',
    imports: [
        CommonModule,
        RouterModule,
        ButtonModule,
        MenuModule,
        BadgeModule,
        RippleModule
    ],
    templateUrl: './NavbarComponent.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavbarComponent implements OnInit {
  // Injected services
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly cartService = inject(CartService);
  private readonly cdr = inject(ChangeDetectorRef);
  
  emailUser: string | null = null;
  role: string | null = null;
  cartItemsCount: number = 0;
  cartTotal: number = 0;
  currentRoute: string = '';
  cartEnabled: boolean = true;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Initialize the current route
    this.currentRoute = this.router.url;

    // Configuration after initial render
    afterNextRender(() => {
      // Subscribe to router events for initial route detection
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(event => {
        this.currentRoute = event.url;
        this.cdr.markForCheck();
      });
    });
  }

  ngOnInit(): void {
    // Subscribe to user email changes
    this.userService.emailUser$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(email => {
      this.emailUser = email;
      this.cdr.markForCheck();
    });

    // Subscribe to user role changes
    this.userService.role$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(role => {
      this.role = role;
      this.cdr.markForCheck();
    });

    // Subscribe to cart changes
    this.cartService.cart$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(cartItems => {
      this.cartItemsCount = cartItems.reduce((total, item) => total + (item.amount || 0), 0);
      this.cartTotal = cartItems.reduce((total, item) => {
        return total + ((item.price || 0) * (item.amount || 0));
      }, 0);
      this.updateCartEnabledState();
      this.cdr.markForCheck();
    });
  }

  isAdmin(): boolean {
    return this.role === 'Admin';
  }

  isListGroupsPage(): boolean {
    return this.currentRoute.includes('/listgroups') || this.currentRoute === '/';
  }

  isOrdersPage(): boolean {
    const isOrdersPage = this.currentRoute.includes('/admin-orders') || this.currentRoute.includes('/orders');
    return isOrdersPage;
  }

  isGenresPage(): boolean {
    return this.currentRoute.includes('/genres') || this.currentRoute === '/genres';
  }

  isGroupsPage(): boolean {
    return this.currentRoute.includes('/groups') || this.currentRoute === '/groups';
  }

  isRecordsPage(): boolean {
    return this.currentRoute.includes('/records') || this.currentRoute === '/records';
  }

  isCartsPage(): boolean {
    return this.currentRoute.includes('/carts') || this.currentRoute === '/carts';
  }

  isUsersPage(): boolean {
    return this.currentRoute.includes('/users') || this.currentRoute === '/users';
  }

  logout(): void {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('role');
    this.userService.clearUser();
    this.router.navigate(['/login']);
    this.cdr.markForCheck();
  }

  isLoginPage(): boolean {
    return this.currentRoute.includes('/login');
  }

  private updateCartEnabledState(): void {
    const disabledRoutes = ['/login', '/register'];
    const wasEnabled = this.cartEnabled;
    this.cartEnabled = !disabledRoutes.some(route => this.currentRoute.startsWith(route));
    
    if (wasEnabled !== this.cartEnabled) {
      this.cdr.markForCheck();
    }
  }
}
