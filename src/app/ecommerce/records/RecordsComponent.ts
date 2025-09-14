import { Component, OnInit, ViewChild, ElementRef, inject, DestroyRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { take } from 'rxjs';

import { IRecord } from '../EcommerceInterface';
import { RecordsService } from '../services/RecordsService';
import { GroupsService } from '../services/GroupsService';
import { StockService } from '../services/StockService';
import { CartService } from '../services/CartService';
import { UserService } from 'src/app/services/UserService';

@Component({
    selector: 'app-records',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        InputTextModule,
        TableModule,
        ToastModule,
        DialogModule,
        ConfirmDialogModule,
        DropdownModule,
        InputNumberModule
    ],
    templateUrl: './RecordsComponent.html',
    providers: [ConfirmationService]
})
export class RecordsComponent implements OnInit {
  @ViewChild("form") form!: NgForm;
  @ViewChild("fileInput") fileInput!: ElementRef;
  visibleError = false;
  errorMessage = "";
  records: IRecord[] = [];
  filteredRecords: IRecord[] = [];
  visibleConfirm = false;
  imageRecord = "";
  visiblePhoto = false;
  photo = "";
  searchText: string = "";

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

  groups: any[] = [];
  // Injected services
  private readonly recordsService = inject(RecordsService);
  private readonly groupsService = inject(GroupsService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly stockService = inject(StockService);
  private readonly cartService = inject(CartService);
  private readonly userService = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {}

  ngOnInit(): void {
    this.getRecords();
    this.getGroups();
    
    // Initialize the form with default values
    this.cancelEdition();

    // Subscribe to stock updates
    this.stockService.stockUpdate$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ recordId, newStock }) => {
        const record = this.records.find((r) => r.idRecord === recordId);
        if (record) {
          record.stock = newStock;
          // Update filtered records as well
          const filteredRecord = this.filteredRecords.find(
            (r) => r.idRecord === recordId
          );
          if (filteredRecord) {
            filteredRecord.stock = newStock;
          }
        }
      });

    // Subscribe to cart updates
    this.cartService.cart$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cartItems) => {
        this.records.forEach((record) => {
          const cartItem = cartItems.find(
            (item) => item.idRecord === record.idRecord
          );
          record.inCart = !!cartItem;
          record.amount = cartItem ? cartItem.amount || 0 : 0;
        });
        this.filteredRecords = [...this.records];
      });
  }


  getRecords() {
    this.recordsService.getRecords().subscribe({
      next: (records: IRecord[]) => {
        // The service now returns a clean array of records
        this.records = [...records]; // Create new array reference
        this.filteredRecords = [...this.records];
        
        // Get groups to assign names
        this.groupsService.getGroups().subscribe({
          next: (groups: any[]) => {
            // Create a new array with updated records
            this.records = this.records.map(record => {
              const group = groups.find(g => g.idGroup === record.groupId);
              return group ? { ...record, groupName: group.nameGroup } : record;
            });
            this.filteredRecords = [...this.records];
            this.cdr.markForCheck(); // Notify Angular to check for changes
          },
          error: (err) => {
            console.error("Error getting groups:", err);
            // Still show records even if group names couldn't be loaded
            this.filteredRecords = [...this.records];
          }
        });
      },
      error: (err) => {
        console.error("Error getting records:", err);
        this.visibleError = true;
        this.controlError(err);
      }
    });
  }

  filterRecords() {
    if (!this.searchText?.trim()) {
      this.filteredRecords = [...this.records];
      this.cdr.markForCheck();
      return;
    }

    const searchTerm = this.searchText.toLowerCase();
    this.filteredRecords = this.records.filter((record) => {
      return (
        record.titleRecord?.toLowerCase().includes(searchTerm) ||
        record.groupName?.toLowerCase().includes(searchTerm) ||
        record.yearOfPublication?.toString().includes(searchTerm)
      );
    });
    this.cdr.markForCheck();
  }

  onSearchChange() {
    this.filterRecords();
  }

  getGroups() {
    this.groupsService.getGroups().subscribe({
      next: (response: any) => {
        // Flexible handling of different response structures
        let groupsArray = [];

        if (Array.isArray(response)) {
          // The answer is a direct array
          groupsArray = response;
        } else if (Array.isArray(response.$values)) {
          // The response has property $values
          groupsArray = response.$values;
        } else if (Array.isArray(response.data)) {
          // The response has data property
          groupsArray = response.data;
        } else {
          console.warn("Unexpected API response structure:", response);
        }

        this.groups = groupsArray;
      },
      error: (err) => {
        console.error("Error loading groups:", err);
        this.visibleError = true;
        this.controlError(err);
      },
    });
  }

  onChange(event: any) {
    const file = event.target.files;

    if (file && file.length > 0) {
      this.record.photo = file[0];
      this.record.photoName = file[0].name;
    }
  }

  onAceptar() {
    this.fileInput.nativeElement.value = "";
  }

  showImage(record: IRecord) {
    if (this.visiblePhoto && this.record === record) {
      this.visiblePhoto = false;
    } else {
      this.record = record;
      this.photo = record.imageRecord!;
      this.visiblePhoto = true;
    }
  }

  save() {
    if (this.record.idRecord === 0) {
      this.recordsService.addRecord(this.record).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.cancelEdition();
          this.form.resetForm();
          this.getRecords();
        },
        error: (err) => {
          console.log(err);
          this.visibleError = true;
          this.controlError(err);
        },
      });
    } else {
      this.recordsService.updateRecord(this.record).subscribe({
        next: (data) => {
          this.visibleError = false;
          this.cancelEdition();
          this.form.resetForm();
          this.getRecords();
        },
        error: (err) => {
          this.visibleError = true;
          this.controlError(err);
        },
      });
    }
  }

  confirmDelete(record: IRecord) {
    this.confirmationService.confirm({
      message: `Delete record ${record.titleRecord}?`,
      header: "Are you sure?",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Yes",
      acceptButtonStyleClass: "p-button-danger",
      accept: () => this.deleteRecord(record.idRecord),
    });
  }

  deleteRecord(id: number) {
    this.recordsService.deleteRecord(id).subscribe({
      next: (data: IRecord) => {
        this.visibleError = false;
        this.getRecords();
      },
      error: (err: any) => {
        this.visibleError = true;
        this.controlError(err);
      },
    });
  }

  edit(record: IRecord) {
    // Create a new object to trigger change detection
    this.record = {
      ...record,
      // Ensure we have a valid stock value
      stock: record.stock === null || record.stock === undefined ? 0 : record.stock,
      // Set photo name if image exists
      photoName: record.imageRecord ? this.extractImageName(record.imageRecord) : null,
      // Ensure we have a valid groupId
      groupId: record.groupId || null
    };
    
    // Force update the view to reflect changes
    this.cdr.detectChanges();
  }

  extractImageName(url: string): string {
    return url.split("/").pop() || "";
  }

  // Compare function for group selection
  compareGroups(group1: any, group2: any): boolean {
    // Handle case where one or both values are null/undefined
    if (!group1 || !group2) {
      return !group1 && !group2; // true only if both are null/undefined
    }
    
    // If either is an object with idGroup, compare by idGroup
    const id1 = group1.idGroup !== undefined ? group1.idGroup : group1;
    const id2 = group2.idGroup !== undefined ? group2.idGroup : group2;
    
    return id1 === id2;
  }

  cancelEdition() {
    // Reset the form first to clear any previous state
    if (this.form) {
      this.form.resetForm();
    }
    
    // Then set the record to default values
    this.record = {
      idRecord: 0,
      titleRecord: "",
      yearOfPublication: null,
      imageRecord: null,
      photo: null,
      photoName: null,
      price: 0,
      stock: 0,
      discontinued: false,
      groupId: null,  // Explicitly set to null
      groupName: "",
      nameGroup: "",
    };
    
    // Force update the view
    this.cdr.detectChanges();
    
    // Small delay to ensure the view is updated
    setTimeout(() => {
      this.cdr.detectChanges();
    });
  }

  controlError(err: any) {
    if (err.error && typeof err.error === "object" && err.error.message) {
      this.errorMessage = err.error.message;
    } else if (typeof err.error === "string") {
      this.errorMessage = err.error;
    } else {
      this.errorMessage = "An unexpected error occurred";
    }
    this.cdr.markForCheck();
  }

  addToCart(record: IRecord): void {
    const userEmail = this.userService.email;
    if (!userEmail) return;

    this.cartService.addToCart(record).subscribe({
      next: (response) => {
        // Create new array with updated record
        this.records = this.records.map(r => 
          r.idRecord === record.idRecord 
            ? { 
                ...r, 
                amount: (r.amount || 0) + 1,
                inCart: true
              } 
            : r
        );
        this.filteredRecords = [...this.records];
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error("Error adding to cart:", error);
        // Revert changes with new references
        this.records = this.records.map(r => 
          r.idRecord === record.idRecord 
            ? { ...r, amount: (r.amount || 0) - 1, inCart: false } 
            : r
        );
        this.filteredRecords = [...this.records];
        this.cdr.markForCheck();
      }
    });
  }

  removeFromCart(record: IRecord): void {
    const userEmail = this.userService.email;
    if (!userEmail || !record.inCart) return;

    // Create a new object reference for the record
    const recordIndex = this.records.findIndex(r => r.idRecord === record.idRecord);
    if (recordIndex === -1) return;

    this.cartService.removeFromCart(record).subscribe({
      next: (response) => {
        // Create new array with updated record
        this.records = this.records.map(r => 
          r.idRecord === record.idRecord 
            ? { 
                ...r, 
                amount: Math.max(0, (r.amount || 0) - 1),
                inCart: (r.amount || 0) > 1 // Will be false if amount becomes 0
              } 
            : r
        );
        this.filteredRecords = [...this.records];
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error("Error removing from cart:", error);
        // Revert changes with new references
        this.records = this.records.map(r => 
          r.idRecord === record.idRecord 
            ? { ...r, amount: (r.amount || 0) + 1, inCart: true } 
            : r
        );
        this.filteredRecords = [...this.records];
        this.cdr.markForCheck();
      }
    });
  }
}
