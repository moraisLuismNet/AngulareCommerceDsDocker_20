import { Component, OnInit, afterNextRender, DestroyRef, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { of, forkJoin } from 'rxjs';
import { filter, map, catchError, tap, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ICartDetail, IRecord, IGroup, GroupResponse, ExtendedCartDetail } from '../EcommerceInterface';
import { UserService } from 'src/app/services/UserService';
import { CartDetailService } from '../services/CartDetailService';
import { CartService } from 'src/app/ecommerce/services/CartService';
import { OrderService } from '../services/OrderService';
import { GroupsService } from '../services/GroupsService';

@Component({
    selector: 'app-cart-details',
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        TableModule,
        ButtonModule,
        InputTextModule,
        TooltipModule
    ],
    templateUrl: './CartDetailsComponent.html',
    styleUrl: './CartDetailsComponent.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartDetailsComponent implements OnInit {
  cartDetails: ICartDetail[] = [];
  filteredCartDetails: ExtendedCartDetail[] = [];
  emailUser: string | null = '';
  isAddingToCart = false;
  private readonly destroyRef = inject(DestroyRef);
  currentViewedEmail: string = '';
  isViewingAsAdmin: boolean = false;
  isCreatingOrder = false;
  alertMessage: string = '';
  alertType: 'success' | 'error' | null = null;
  // Injected services
  private readonly cartDetailService = inject(CartDetailService);
  private readonly route = inject(ActivatedRoute);
  private readonly userService = inject(UserService);
  private readonly cartService = inject(CartService);
  private readonly orderService = inject(OrderService);
  private readonly groupsService = inject(GroupsService);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    // One-time initialization after the first render
    afterNextRender(() => {
      // Any DOM-dependent initialization can go here
    });
  }

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const viewingUserEmail = params['viewingUserEmail'];

        if (viewingUserEmail && this.userService.isAdmin()) {
          // Admin
          this.isViewingAsAdmin =
            viewingUserEmail && this.userService.isAdmin();
          this.currentViewedEmail = viewingUserEmail;
          this.isViewingAsAdmin = true;
          this.loadCartDetails(viewingUserEmail);
        } else {
          // User viewing their own cart
          this.userService.email$
            .pipe(
              takeUntilDestroyed(this.destroyRef),
              filter((email): email is string => !!email)
            )
            .subscribe((email) => {
              this.currentViewedEmail = email;
              this.isViewingAsAdmin = false;
              this.loadCartDetails(email);
            });
        }
      });
  }

  private loadCartDetails(email: string): void {
    this.cartDetailService
      .getCartDetailsByEmail(email)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map((response: any) => {
          // If you are an admin or do not have a cart, the response will be an empty array.
          if (Array.isArray(response)) {
            return response;
          }
          // Handle backend response format
          return response?.$values || response?.Items || [];
        }),
        catchError((error) => {
          console.error('Error loading cart details:', error);
          return of([]); // Always return empty array on errors
        })
      )
      .subscribe((details) => {
        this.cartDetails = [...details]; // Create new array reference
        this.filteredCartDetails = this.getFilteredCartDetails();
        this.cdr.markForCheck(); // Mark for change detection
        this.loadRecordDetails();
      });
  }

  private loadRecordDetails(): void {
    // First we get all the groups to have the names
    this.groupsService.getGroups().pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap((groupsResponse: IGroup[] | GroupResponse) => {
        // Convert the response to an array of groups
        const groups = Array.isArray(groupsResponse) 
          ? groupsResponse 
          : (groupsResponse as GroupResponse)?.$values || [];
        
        // Create a map of groupId to groupName for quick search
        const groupMap = new Map<number, string>();
        groups.forEach((group: IGroup) => {
          if (group?.idGroup) {
            groupMap.set(group.idGroup, group.nameGroup || '');
          }
        });

        // For each detail in the cart, get the record details and assign the groupName
        const recordDetails$ = this.filteredCartDetails.map(detail => 
          this.cartDetailService.getRecordDetails(detail.recordId).pipe(
            filter((record): record is IRecord => record !== null),
            map(record => ({
              detail,
              record,
              groupName: record.groupId ? groupMap.get(record.groupId) || '' : ''
            }))
          )
        );

        return forkJoin(recordDetails$);
      })
    ).subscribe(results => {
      let hasChanges = false;
      
      results.forEach(({ detail, record, groupName }) => {
        const index = this.filteredCartDetails.findIndex(
          d => d.recordId === detail.recordId
        );
        
        if (index !== -1) {
          const currentDetail = this.filteredCartDetails[index];
          const updatedDetail = {
            ...currentDetail,
            stock: record.stock,
            groupName: groupName || record.groupName || '',
            titleRecord: record.titleRecord || currentDetail.titleRecord,
            price: record.price || currentDetail.price
          } as ExtendedCartDetail;
          
          // Check if there are changes before updating
          if (JSON.stringify(currentDetail) !== JSON.stringify(updatedDetail)) {
            this.filteredCartDetails[index] = updatedDetail;
            hasChanges = true;
          }
        }
      });
      
      // Update only if changes occurred
      if (hasChanges) {
        this.filteredCartDetails = [...this.filteredCartDetails];
        this.cdr.markForCheck(); // Mark for change detection
      }
    });
  }

  private getFilteredCartDetails(): ExtendedCartDetail[] {
    if (!Array.isArray(this.cartDetails)) return [];

    return this.cartDetails.filter(
      (detail) =>
        detail && typeof detail.amount === 'number' && detail.amount > 0
    ) as ExtendedCartDetail[];
  }

  async addToCart(detail: ICartDetail): Promise<void> {
    if (!this.currentViewedEmail || this.isAddingToCart) return;

    this.isAddingToCart = true;
    this.clearAlert();

    try {
      // Convert ICartDetail to IRecord format expected by cartService
      const record: IRecord = {
        idRecord: detail.recordId,
        titleRecord: detail.titleRecord || '',
        price: detail.price || 0,
        stock: (detail as any).stock || 0,
        amount: detail.amount || 0,
        inCart: true
      } as IRecord;

      await this.cartService.addToCart(record).toPromise();
      
      // Instead of updating locally, reload the cart details to get fresh stock information
      await this.loadCartDetails(this.currentViewedEmail);
      
      this.showAlert('Product added to cart', 'success');
    } catch (error) {
      console.error('Error adding to cart:', error);
      this.showAlert('Failed to add product to cart', 'error');
    } finally {
      this.isAddingToCart = false;
      this.cdr.markForCheck();
    }
  }

  async removeRecord(detail: ICartDetail): Promise<void> {
    if (!this.currentViewedEmail || !detail.amount || detail.amount <= 0) return;

    this.isAddingToCart = true;
    this.clearAlert();

    try {
      // Convert ICartDetail to IRecord format expected by cartService
      const record: IRecord = {
        idRecord: detail.recordId,
        titleRecord: detail.titleRecord || '',
        price: detail.price || 0,
        stock: (detail as any).stock || 0,
        amount: detail.amount || 0,
        inCart: true
      } as IRecord;

      await this.cartService.removeFromCart(record).toPromise();
      
      // Instead of updating locally, reload the cart details to get fresh stock information
      await this.loadCartDetails(this.currentViewedEmail);
      
      this.showAlert('Product removed from cart', 'success');
    } catch (error) {
      console.error('Error removing from cart:', error);
      this.showAlert('Failed to remove product from cart', 'error');
    } finally {
      this.isAddingToCart = false;
      this.cdr.markForCheck();
    }
  }

  private showAlert(message: string, type: 'success' | 'error'): void {
    this.alertMessage = message;
    this.alertType = type;
    this.cdr.markForCheck(); // Mark for change detection

    // Hide the message after 5 seconds
    setTimeout(() => this.clearAlert(), 5000);
  }

  private clearAlert(): void {
    this.alertMessage = '';
    this.alertType = null;
    this.cdr.markForCheck(); // Mark for change detection
  }

  async createOrder(): Promise<void> {
    if (!this.currentViewedEmail || this.isViewingAsAdmin) return;

    this.isCreatingOrder = true;
    this.clearAlert();
    this.cdr.markForCheck(); // Mark for change detection

    try {
      const paymentMethod = 'credit-card';
      const order = await this.orderService
        .createOrderFromCart(this.currentViewedEmail, paymentMethod)
        .toPromise();

      this.showAlert('Order created successfully', 'success');
      await this.loadCartDetails(this.currentViewedEmail);
      this.cartService.updateCartNavbar(0, 0);
      this.cdr.markForCheck(); // Mark for change detection
    } catch (error: any) {
      console.error('Full error:', error);
      const errorMsg = error.error?.message || 'Failed to create order';
      this.showAlert(errorMsg, 'error');
    } finally {
      this.isCreatingOrder = false;
      this.cdr.markForCheck(); // Mark for change detection
    }
  }

}
