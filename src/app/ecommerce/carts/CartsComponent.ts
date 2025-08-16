import { Component, OnInit, afterNextRender, inject, DestroyRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';

import { UserService } from 'src/app/services/UserService';
import { CartService } from '../services/CartService';
import { ICart } from '../EcommerceInterface';

@Component({
    selector: 'app-carts',
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        TableModule,
        ButtonModule,
        InputTextModule,
        DialogModule,
        ConfirmDialogModule,
        ToastModule
    ],
    templateUrl: './CartsComponent.html',
    styleUrl: './CartsComponent.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartsComponent implements OnInit {
  carts: ICart[] = [];
  filteredCarts: ICart[] = [];
  loading = false;
  errorMessage = '';
  isAdmin = false;
  searchText: string = '';
  visibleError = false;
  
  // Injected services
  private readonly cartService = inject(CartService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  
  private searchSubject = new Subject<string>();
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // One-time initialization after the first render
    afterNextRender(() => {
      this.setupSearch();
    });
  }

  ngOnInit(): void {
    this.isAdmin = this.userService.isAdmin();
    this.loadCarts();
  }

  loadCarts(): void {
    this.loading = true;

    if (this.isAdmin) {
      this.cartService.getAllCarts().subscribe({
        next: (data: any) => {
          // Extracts values ​​correctly from the response object
          const receivedCarts = data.$values || data;

          // Ensures that it is always an array
          this.carts = Array.isArray(receivedCarts)
            ? [...receivedCarts] // Create new array reference
            : [{...receivedCarts}]; // Create new object in array

          this.filteredCarts = [...this.carts];
          this.loading = false;
          this.cdr.markForCheck(); // Mark for change detection
        },
        error: (error) => {
          console.error('Error:', error);
          this.errorMessage = 'Error loading carts';
          this.visibleError = true;
          this.loading = false;
          this.cdr.markForCheck(); // Mark for change detection
        },
      });
    } else {
      const userEmail = this.userService.email;
      if (!userEmail) {
        this.errorMessage = 'No user logged in';
        this.visibleError = true;
        this.loading = false;
        return;
      }

      this.cartService.getCart(userEmail).subscribe({
        next: (data) => {
          this.carts = Array.isArray(data) ? [...data] : [{...data}];
          this.filteredCarts = [...this.carts];
          this.loading = false;
          this.cdr.markForCheck(); // Mark for change detection
        },
        error: (error) => {
          this.errorMessage = 'Error loading your cart';
          this.visibleError = true;
          this.loading = false;
          this.cdr.markForCheck(); // Mark for change detection
        },
      });
    }
  }

  private filterCarts(searchText: string = this.searchText): void {
    if (!searchText) {
      this.filteredCarts = [...this.carts];
    } else {
      const searchLower = searchText.toLowerCase();
      this.filteredCarts = this.carts.filter((cart) =>
        cart.userEmail.toLowerCase().includes(searchLower)
      );
    }
    this.cdr.markForCheck(); // Mark for change detection
  }

  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(searchText => {
      this.filterCarts(searchText);
    });
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchText);
  }

  // Method to navigate to details
  navigateToCartDetails(userEmail: string): void {
    this.router.navigate(['/cart-details'], {
      queryParams: { email: userEmail },
    });
  }

  // No need for ngOnDestroy when using takeUntilDestroyed

  toggleCartStatus(email: string, enable: boolean): void {
    this.loading = true;
    this.cdr.markForCheck(); // Mark for change detection

    const operation = enable
      ? this.cartService.enableCart(email)
      : this.cartService.disableCart(email);

    operation.subscribe({
      next: (updatedCart) => {
        // Update cart immutably
        const cartIndex = this.carts.findIndex((c) => c.userEmail === email);
        if (cartIndex !== -1) {
          this.carts = [
            ...this.carts.slice(0, cartIndex),
            {
              ...this.carts[cartIndex],
              enabled: enable,
              totalPrice: enable ? this.carts[cartIndex].totalPrice : 0,
            },
            ...this.carts.slice(cartIndex + 1)
          ];
          this.filterCarts(); // This will call markForCheck()
        } else {
          this.loading = false;
          this.cdr.markForCheck();
        }
      },
      error: (error) => {
        console.error('Error toggling cart status:', error);
        this.errorMessage = `Error ${enable ? 'enabling' : 'disabling'} cart`;
        this.visibleError = true;
        this.loading = false;
        this.cdr.markForCheck(); // Mark for change detection
      },
    });
  }
}
