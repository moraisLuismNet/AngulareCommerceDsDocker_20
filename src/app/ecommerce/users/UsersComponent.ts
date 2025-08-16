import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';

import { IUser } from '../EcommerceInterface';
import { UsersService } from '../services/UsersService';

@Component({
    selector: 'app-users',
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        InputTextModule,
        TableModule,
        ToastModule,
        ConfirmDialogModule,
        DialogModule
    ],
    templateUrl: './UsersComponent.html',
    providers: [ConfirmationService, MessageService],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersComponent implements OnInit {
  users: IUser[] = [];
  filteredUsers: IUser[] = [];
  loading = true;
  searchText = "";
  errorMessage = "";
  visibleError = false;

  // Injected services
  private readonly usersService = inject(UsersService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.usersService.getUsers().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (users) => {
        this.users = Array.isArray(users) ? [...users] : [];
        this.filteredUsers = [...this.users];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error("Error loading users:", error);
        this.errorMessage = this.getErrorMessage(error);
        this.visibleError = true;
        this.users = [];
        this.filteredUsers = [];
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private getErrorMessage(error: any): string {
    if (error.status === 401) {
      return "You don't have permission to view users. Please log in as an administrator.";
    }
    return "Error loading users. Please try again..";
  }

  confirmDelete(email: string): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete the user "${email}"?<br/><span class="delete-warning" style="color: #dc3545; font-weight: bold;">This action cannot be undone!</span>`,
      header: "Delete User",
      icon: "pi pi-exclamation-triangle",
      acceptButtonStyleClass: "p-button-danger",
      rejectButtonStyleClass: "p-button-secondary",
      acceptIcon: "pi pi-check",
      acceptLabel: "Yes",
      rejectLabel: "No",
      accept: () => {
        this.deleteUser(email);
      },
    });
  }

  deleteUser(email: string): void {
    this.usersService.deleteUser(email).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.messageService.add({
          severity: "success",
          summary: "Success",
          detail: "User successfully deleted",
        });
        this.loadUsers();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error("Error deleting user:", error);
        this.messageService.add({
          severity: "error",
          summary: "Error",
          detail: "Error deleting user",
        });
        this.cdr.markForCheck();
      },
    });
  }

  onSearchChange(): void {
    if (!this.searchText) {
      this.filteredUsers = [...this.users];
    } else {
      const searchTerm = this.searchText.toLowerCase();
      this.filteredUsers = this.users.filter((user) =>
        user.email.toLowerCase().includes(searchTerm)
      );
    }
    this.cdr.markForCheck();
  }
}
