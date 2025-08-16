import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { OrderService } from '../services/OrderService';
import { UserService } from 'src/app/services/UserService';
import { IOrder } from '../EcommerceInterface';

@Component({
    selector: 'app-orders',
    imports: [
        CommonModule,
        FormsModule,
        TableModule,
        ButtonModule,
        InputTextModule
    ],
    templateUrl: './OrdersComponent.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersComponent implements OnInit {
  orders: IOrder[] = [];
  filteredOrders: IOrder[] = [];
  loading = true;
  searchText: string = '';
  expandedOrderId: number | null = null;

  // Injected services
  private readonly orderService = inject(OrderService);
  private readonly userService = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  private searchSubject = new Subject<string>();

  constructor() {}

  ngOnInit(): void {
    this.userService.emailUser$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((email) => {
      if (email) {
        this.loadOrders(email);
      } else {
        this.orders = [];
        this.filteredOrders = [];
        this.cdr.markForCheck();
      }
    });
  }

  loadOrders(email: string): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.orderService.getOrdersByUserEmail(email).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (orders) => {
        this.orders = Array.isArray(orders) ? [...orders] : [];
        this.filteredOrders = [...this.orders];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading orders:', err);
        this.orders = [];
        this.filteredOrders = [];
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }


  toggleOrderDetails(orderId: number): void {
    this.expandedOrderId = this.expandedOrderId === orderId ? null : orderId;
    this.cdr.markForCheck();
  }

  isOrderExpanded(orderId: number): boolean {
    return this.expandedOrderId === orderId;
  }

  filterOrders() {
    if (!this.searchText) {
      this.filteredOrders = [...this.orders];
    } else {
      const searchLower = this.searchText.toLowerCase();
      this.filteredOrders = this.orders.filter((order) =>
        order.orderDate.toLowerCase().includes(searchLower)
      );
    }
    this.cdr.markForCheck();
  }

  onSearchChange() {
    this.filterOrders();
  }
}
