import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DropdownModule } from 'primeng/dropdown';
import { of, throwError } from 'rxjs';
import { finalize, switchMap, map, catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { IRecord } from '../EcommerceInterface';
import { RecordsService } from '../services/RecordsService';
import { GroupsService } from '../services/GroupsService';
import { CartService } from '../services/CartService';
import { UserService } from 'src/app/services/UserService';
import { StockService } from '../services/StockService';
import { AuthGuard } from 'src/app/guards/AuthGuardService';

@Component({
    selector: 'app-listrecords',
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        ButtonModule,
        InputTextModule,
        TableModule,
        ToastModule,
        DialogModule,
        ConfirmDialogModule,
        DropdownModule
    ],
    templateUrl: './ListrecordsComponent.html',
    providers: [ConfirmationService]
})
export class ListrecordsComponent implements OnInit {

  records: IRecord[] = [];
  filteredRecords: IRecord[] = [];
  searchText: string = "";
  cart: IRecord[] = [];
  groupId: string | null = null;
  groupName: string = "";
  errorMessage: string = "";
  visibleError: boolean = false;
  visiblePhoto: boolean = false;
  photo: string = "";
  cartItemsCount: number = 0;
  isAddingToCart = false;
  private readonly destroyRef = inject(DestroyRef);
  loading: boolean = false;
  cartEnabled: boolean = false;

  record: IRecord = {
    idRecord: 0,
    titleRecord: "",
    yearOfPublication: null,
    imageRecord: null,
    photo: null,
    photoName: null,
    price: 0,
    stock: 0,
    discontinued: false,
    groupId: null,
    groupName: "",
    nameGroup: "",
  };
  userEmail: string | null = null;

  // Injected services
  private readonly recordsService = inject(RecordsService);
  private readonly groupsService = inject(GroupsService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly cartService = inject(CartService);
  private readonly userService = inject(UserService);
  private readonly stockService = inject(StockService);
  private readonly authGuard = inject(AuthGuard);

  constructor() {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const idGroup = params.get("idGroup");
      if (idGroup) {
        this.groupId = idGroup;
        this.loadRecords(idGroup);
      } else {
        this.errorMessage = "No group ID provided";
        this.visibleError = true;
      }
    });

    // Only configure subscriptions if the user is authenticated
    if (this.authGuard.isLoggedIn()) {
      this.setupSubscriptions();
      this.userEmail = this.authGuard.getUser();
      this.checkCartStatus();
    }
  }

  checkCartStatus() {
    if (!this.userEmail) {
      this.cartEnabled = false;
      return;
    }

    this.cartService.getCartStatus(this.userEmail).subscribe({
      next: (status) => {
        this.cartEnabled = status.enabled;
      },
      error: (error) => {
        console.error("Error checking cart status:", error);
        this.cartEnabled = true;
      },
    });
  }

  private setupSubscriptions(): void {
    // Subscribe to cart changes
    this.cartService.cart$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cartItems: IRecord[]) => {
        // Update cart status for all records
        [this.records, this.filteredRecords].forEach((recordArray) => {
          recordArray.forEach((record) => {
            const cartItem = cartItems.find(
              (item: IRecord) => item.idRecord === record.idRecord
            );
            if (cartItem) {
              record.amount = cartItem.amount;
            } else {
              record.amount = 0;
            }
          });
        });
      });

    // Subscribe to stock updates
    this.stockService.stockUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ recordId, newStock }: { recordId: number; newStock: number }) => {
        if (typeof newStock !== "number") {
          console.error("Invalid stock value received:", newStock);
          return;
        }
        // Update stock in both records and filteredRecords arrays
        [this.records, this.filteredRecords].forEach((recordArray) => {
          const record = recordArray.find((r) => r.idRecord === recordId);
          if (record) {
            record.stock = newStock;
          }
        });
      });

    // Subscribe to cart item count
    this.cartService.cartItemCount$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((count: number) => {
        this.cartItemsCount = count;
      });

    // Subscribe to user email changes
    this.userService.emailUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((email: string | null) => {
        this.userEmail = email;
      });
  }

  confirm(): void {
    this.confirmationService.confirm({
      message: "Are you sure you want to continue?",
      accept: () => {},
    });
  }

  isLoggedIn(): boolean {
    return !!sessionStorage.getItem("user");
  }

  loadRecords(idGroup: string): void {
    this.loading = true;
    this.errorMessage = "";
    this.visibleError = false;

    // First we synchronize the cart with the backend
    if (this.userEmail) {
      this.cartService.syncCartWithBackend(this.userEmail);
    }

    this.recordsService
      .getRecordsByGroup(idGroup)
      .pipe(
        switchMap((records: IRecord[]) => {
          if (!records || records.length === 0) {
            this.errorMessage = "No records found for this group";
            this.visibleError = true;
            return of([]);
          }

          this.records = records;
          // Get cart items to sync cart status
          return this.cartService.getCartItems().pipe(
            map((cartItems: IRecord[]) => {
              // Update cart status for each record
              this.records.forEach((record) => {
                const cartItem = cartItems.find(
                  (item) => item.idRecord === record.idRecord
                );
                if (cartItem) {
                  record.inCart = true;
                  record.amount = cartItem.amount;
                } else {
                  record.inCart = false;
                  record.amount = 0;
                }
              });
              return this.records;
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (records: IRecord[]) => {
          this.getGroupName(idGroup);
          this.filterRecords();
        },
        error: (error) => {
          console.error("Error loading records:", error);
          this.errorMessage = "Error loading records";
          this.visibleError = true;
        },
      });
  }

  getGroupName(idGroup: string): void {
    this.groupsService
      .getGroupName(idGroup)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (nameGroup: string) => {
          this.groupName = nameGroup;
        },
        error: (error) => {
          console.error("Error loading group name:", error);
          this.errorMessage = "Error loading group name";
          this.visibleError = true;
        },
      });
  }

  filterRecords(): void {
    if (!this.searchText) {
      this.filteredRecords = [...this.records];
    } else {
      this.filteredRecords = this.records.filter((record) => {
        return (
          record.groupName
            .toLowerCase()
            .includes(this.searchText.toLowerCase()) ||
          record.titleRecord
            .toLowerCase()
            .includes(this.searchText.toLowerCase()) ||
          (record.yearOfPublication
            ? record.yearOfPublication.toString().includes(this.searchText)
            : false)
        );
      });
    }
  }

  onSearchChange(): void {
    this.filterRecords();
  }

  showImage(record: IRecord): void {
    if (this.visiblePhoto && this.record === record) {
      this.visiblePhoto = false;
    } else {
      this.record = record;
      this.photo = record.imageRecord!;
      this.visiblePhoto = true;
    }
  }

  addToCart(record: IRecord): void {
    if (this.isAddingToCart || !record.stock || record.stock <= 0) {
      return;
    }

    this.isAddingToCart = true;
    this.errorMessage = "";
    this.visibleError = false;

    this.cartService
      .addToCart(record)
      .pipe(finalize(() => (this.isAddingToCart = false)))
      .subscribe({
        next: (updatedRecord) => {},
        error: (error) => {
          this.errorMessage = error.message || "Error adding to cart";
          this.visibleError = true;
          console.error("Error adding:", error);
        },
      });
  }

  removeRecord(record: IRecord): void {
    if (!record.amount || this.isAddingToCart) return;
    this.isAddingToCart = true;
    const prevAmount = record.amount;
    record.amount = Math.max(0, prevAmount - 1);

    this.cartService
      .removeFromCart(record)
      .pipe(
        finalize(() => {
          this.isAddingToCart = false;
        }),
        catchError((error) => {
          // Revert local changes
          record.amount = prevAmount;
          return throwError(error);
        })
      )
      .subscribe({
        next: () => {
          // Update cart status
          if (this.userEmail) {
            this.cartService.syncCartWithBackend(this.userEmail);
          }
        },
        error: (error) => {
          console.error("Error deleting item from cart:", error);
          this.errorMessage = "Error deleting item from cart";
          this.visibleError = true;
        },
      });
  }



  isAdmin(): boolean {
    return this.userService.isAdmin();
  }
}
