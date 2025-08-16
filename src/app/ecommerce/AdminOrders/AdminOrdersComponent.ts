import { Component, OnInit, afterNextRender, inject, DestroyRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { OrderService } from '../services/OrderService';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { IOrder } from '../EcommerceInterface';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

@Component({
    selector: 'app-admin-orders',
    imports: [
        CommonModule,
        FormsModule,
        TableModule,
        ButtonModule,
        InputTextModule
    ],
    templateUrl: './AdminOrdersComponent.html',
    styleUrl: './AdminOrdersComponent.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminOrdersComponent implements OnInit {
  orders: IOrder[] = [];
  filteredOrders: IOrder[] = [];
  loading = true;
  searchText: string = '';
  expandedOrderId: number | null = null;
  private searchSubject = new Subject<string>();
  private readonly destroyRef = inject(DestroyRef);
  
  // Injected services
  private readonly orderService = inject(OrderService);
  private readonly cdr = inject(ChangeDetectorRef);

  constructor() {
    // One-time initialization after the first render
    afterNextRender(() => {
      this.setupSearch();
    });
  }

  ngOnInit(): void {
    this.loadAllOrders();
  }

  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(searchText => {
      this.filterOrders(searchText);
    });
  }

  loadAllOrders(): void {
    this.loading = true;
    this.cdr.markForCheck(); // Mark for change detection
    
    this.orderService.getAllOrders().subscribe({
      next: (orders) => {
        this.orders = [...orders]; // Create new array reference
        this.filteredOrders = [...orders]; // Create new array reference
        this.loading = false;
        this.cdr.markForCheck(); // Mark for change detection
      },
      error: (err) => {
        console.error('Error loading all orders:', err);
        this.orders = [];
        this.filteredOrders = [];
        this.loading = false;
        this.cdr.markForCheck(); // Mark for change detection
      },
    });
  }

  toggleOrderDetails(orderId: number): void {
    this.expandedOrderId = this.expandedOrderId === orderId ? null : orderId;
    this.cdr.markForCheck(); // Mark for change detection
  }

  isOrderExpanded(orderId: number): boolean {
    return this.expandedOrderId === orderId;
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchText.trim().toLowerCase());
  }

  private filterOrders(searchText: string): void {
    if (!searchText) {
      this.filteredOrders = [...this.orders]; // Create new array reference
      this.cdr.markForCheck(); // Mark for change detection
      return;
    }

    const searchLower = searchText.toLowerCase();
    this.filteredOrders = this.orders.filter(
      (order) =>
        order.userEmail.toLowerCase().includes(searchLower) ||
        order.idOrder.toString().includes(searchLower) ||
        order.paymentMethod.toLowerCase().includes(searchLower) ||
        (order.orderDate &&
          new Date(order.orderDate).toLocaleDateString().includes(searchLower))
    );
    this.cdr.markForCheck(); // Mark for change detection
  }

}
