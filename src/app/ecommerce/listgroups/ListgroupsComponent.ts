import { Component, OnInit, ViewChild, ElementRef, inject, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DropdownModule } from 'primeng/dropdown';

import { IGroup } from '../EcommerceInterface';
import { GroupsService } from '../services/GroupsService';
import { GenresService } from '../services/GenresService';

@Component({
    selector: 'app-listgroups',
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
    templateUrl: './ListgroupsComponent.html',
    providers: [ConfirmationService],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListgroupsComponent implements OnInit {
  @ViewChild('form') form!: NgForm;
  @ViewChild('fileInput') fileInput!: ElementRef;
  visibleError = false;
  errorMessage = '';
  groups: IGroup[] = [];
  filteredGroups: IGroup[] = [];
  visibleConfirm = false;
  imageGroup = '';
  visiblePhoto = false;
  photo = '';
  searchText: string = '';

  group: IGroup = {
    idGroup: 0,
    nameGroup: '',
    imageGroup: null,
    photo: null,
    musicGenreId: 0,
    musicGenreName: '',
    musicGenre: '',
  };

  genres: any[] = [];
  records: any[] = [];

  // Injected services
  private readonly groupsService = inject(GroupsService);
  private readonly genresService = inject(GenresService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {}

  ngOnInit(): void {
    this.getGroups();
    this.getGenres();
  }

  getGroups() {
    this.groupsService.getGroups().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => {
        this.visibleError = false;
        // We check if data has a $values property
        this.groups = (data as any).$values ? [...(data as any).$values] : [...data];
        this.filterGroups();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.visibleError = true;
        this.controlError(err);
        this.cdr.markForCheck();
      },
    });
  }

  getGenres() {
    this.genresService.getGenres().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data) => {
        this.genres = Array.isArray(data) ? [...data] : [];
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.visibleError = true;
        this.controlError(err);
        this.cdr.markForCheck();
      },
    });
  }

  private controlError(err: any): void {
    if (!err) {
      this.errorMessage = 'An unknown error occurred';
    } else if (err.error && typeof err.error === 'object' && err.error.message) {
      this.errorMessage = err.error.message;
    } else if (typeof err.error === 'string') {
      this.errorMessage = err.error;
    } else if (err.message) {
      this.errorMessage = err.message;
    } else {
      this.errorMessage = 'An unexpected error occurred';
    }
    this.visibleError = true;
    this.cdr.markForCheck();
  }

  filterGroups(): void {
    if (!Array.isArray(this.groups)) {
      this.groups = [];
    }
    const searchLower = this.searchText.toLowerCase();
    this.filteredGroups = this.groups.filter(group => 
      group.nameGroup?.toLowerCase().includes(searchLower)
    );
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    this.filterGroups();
  }

  showImage(group: IGroup): void {
    if (this.visiblePhoto && this.group.idGroup === group.idGroup) {
      this.visiblePhoto = false;
    } else {
      this.group = { ...group };
      this.photo = group.imageGroup || '';
      this.visiblePhoto = true;
    }
    this.cdr.markForCheck();
  }

  loadRecords(idGroup: string): void {
    this.router.navigate(['/listrecords', idGroup]);
  }
}
