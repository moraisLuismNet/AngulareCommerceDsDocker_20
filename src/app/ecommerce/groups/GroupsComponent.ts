import { Component, OnInit, ViewChild, ElementRef, inject, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, AfterViewInit } from '@angular/core';
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

import { IGroup } from '../EcommerceInterface';
import { GroupsService } from '../services/GroupsService';
import { GenresService } from '../services/GenresService';

@Component({
    selector: 'app-groups',
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        InputTextModule,
        TableModule,
        ToastModule,
        DialogModule,
        ConfirmDialogModule,
        DropdownModule
    ],
    templateUrl: './GroupsComponent.html',
    providers: [ConfirmationService],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupsComponent implements OnInit, AfterViewInit {
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
  genresLoaded = false;
  selectedGenreId: number | null = null;
  loading = false;
  photoName: string = '';
  
  // Injected services
  private readonly groupsService = inject(GroupsService);
  private readonly genresService = inject(GenresService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {}

  ngOnInit(): void {
    this.getGroups();
    
    // Load genres and reset form after they're loaded
    this.loadGenres().then(() => {
      // Small delay to ensure the view is ready
      setTimeout(() => {
        this.resetForm();
      }, 0);
    });
  }

  ngAfterViewInit(): void {
    // Ensure the default selection is set after view initialization
    setTimeout(() => {
      this.selectedGenreId = null;
      this.cdr.detectChanges();
    });
  }

  private resetForm(): void {
    // First reset the form group
    this.group = {
      idGroup: 0,
      nameGroup: '',
      imageGroup: null,
      photo: null,
      musicGenreId: 0,
      musicGenreName: '',
      musicGenre: '',
      photoName: ''
    };
    
    // Reset the file input if it exists
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
    
    // Reset the selected genre ID
    this.selectedGenreId = null;
    this.photoName = '';
    
    // Force change detection in the next tick
    setTimeout(() => {
      this.cdr.detectChanges();
      
      // Double check after a small delay
      setTimeout(() => {
        if (this.selectedGenreId !== null) {
          this.selectedGenreId = null;
          this.cdr.detectChanges();
        }
      }, 0);
    }, 0);
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
  
  private loadGenres(): Promise<void> {
    this.genresLoaded = false;
    this.cdr.markForCheck();
    
    return new Promise((resolve, reject) => {
      this.genresService.getGenres().pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (data: any) => {
          const genresArray = Array.isArray(data) ? [...data] : [];
          
          if (genresArray.length > 0) {
            this.genres = genresArray;
            this.genresLoaded = true;
            this.visibleError = false;
            
            // Set initial selection to null to show the default option
            this.selectedGenreId = null;
            
            // Force change detection
            this.cdr.detectChanges();
            
            // Ensure the form is reset after genres are loaded
            this.resetForm();
            
            resolve();
          } else {
            const error = new Error('No genres found');
            console.error('Error: No genres found');
            this.visibleError = true;
            this.errorMessage = 'No genres found. Please try again later.';
            this.cdr.markForCheck();
            reject(error);
          }
        },
        error: (err) => {
          console.error('Error loading genres:', err);
          this.visibleError = true;
          this.controlError(err);
          this.cdr.markForCheck();
          reject(err);
        },
      });
    });
  }

  getGroups() {
    this.loading = true;
    this.cdr.markForCheck();
    
    this.groupsService.getGroups().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (groups: IGroup[]) => {
        this.visibleError = false;
        this.groups = Array.isArray(groups) ? [...groups] : [];
        this.filteredGroups = [...this.groups];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error fetching groups:', err);
        this.visibleError = true;
        this.errorMessage = 'Failed to load groups. Please try again.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  filterGroups() {
    if (!this.searchText) {
      this.filteredGroups = [...this.groups];
    } else {
      const searchLower = this.searchText.toLowerCase();
      this.filteredGroups = this.groups.filter((group) =>
        group.nameGroup?.toLowerCase().includes(searchLower)
      );
    }
    this.cdr.markForCheck();
  }

  onSearchChange() {
    this.filterGroups();
  }

  save() {
    // Mark all form controls as touched to trigger validation
    if (this.form) {
      Object.keys(this.form.controls).forEach(key => {
        this.form.controls[key].markAsTouched();
      });
    }

    // Check if form is valid
    if (this.form?.invalid) {
      console.error('Form is invalid');
      this.visibleError = true;
      this.errorMessage = 'Please fill in all required fields correctly.';
      this.cdr.markForCheck();
      return;
    }

    // Ensure we have the required genre information
    if (this.selectedGenreId === null || this.selectedGenreId === undefined) {
      console.error('No genre selected');
      this.visibleError = true;
      this.errorMessage = 'Please select a music genre.';
      this.cdr.markForCheck();
      return;
    }

    // Update the group with the selected genre
    const selectedGenre = this.genres.find(g => g.idMusicGenre === this.selectedGenreId);
    if (selectedGenre) {
      this.group.musicGenre = selectedGenre.nameMusicGenre;
      this.group.musicGenreId = selectedGenre.idMusicGenre;
      this.group.musicGenreName = selectedGenre.nameMusicGenre;
    }

    const groupOperation = this.group.idGroup === 0
      ? this.groupsService.addGroup(this.group)
      : this.groupsService.updateGroup(this.group);

    this.loading = true;
    this.cdr.markForCheck();

    groupOperation.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.visibleError = false;
        this.loading = false;
        this.resetForm();
        this.getGroups();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error saving group:', err);
        this.visibleError = true;
        this.loading = false;
        this.controlError(err);
        this.cdr.markForCheck();
      }
    });
  }

  async edit(group: IGroup) {
    try {
      // Reset form first to ensure clean state
      this.resetForm();
      
      // Load genres if not already loaded
      if (!this.genresLoaded) {
        await this.loadGenres();
      }
      
      // Verify that we have genres before continuing
      if (this.genres.length === 0) {
        console.error('No genres available');
        this.visibleError = true;
        this.errorMessage = 'Genres cannot be loaded. Please try again.';
        this.cdr.markForCheck();
        return;
      }

      // Make a deep copy of the group
      this.group = { 
        ...JSON.parse(JSON.stringify(group)),
        photo: null,
        photoName: group.imageGroup ? this.extractNameImage(group.imageGroup) : ''
      };
      
      // Set the selected genre ID
      this.selectedGenreId = group.musicGenreId || null;
      
      // Ensure the form reflects the selected genre
      if (this.selectedGenreId !== null) {
        const genre = this.genres.find(g => g.idMusicGenre === this.selectedGenreId);
        if (genre) {
          this.group.musicGenre = genre.nameMusicGenre;
          this.group.musicGenreId = genre.idMusicGenre;
          this.group.musicGenreName = genre.nameMusicGenre;
        }
      }
      
      // Force update the form
      if (this.form) {
        this.form.form.markAsPristine();
        this.form.form.markAsUntouched();
      }
      
      this.cdr.detectChanges();
      
      // Additional check after a small delay
      setTimeout(() => {
        if (this.selectedGenreId === null && this.group.musicGenreId) {
          this.selectedGenreId = this.group.musicGenreId;
          this.cdr.detectChanges();
        }
      }, 50);
      
    } catch (error) {
      console.error('Error in edit:', error);
      this.visibleError = true;
      this.errorMessage = 'Error loading group data. Please try again.';
      this.controlError(error);
      this.cdr.markForCheck();
    }
  }

  extractNameImage(url: string | null): string {
    if (!url) return '';
    try {
      // Handle both absolute and relative URLs
      const urlObj = new URL(url, window.location.origin);
      const path = urlObj.pathname;
      return path.split('/').pop() || '';
    } catch (e) {
      // If URL parsing fails, try basic string splitting
      const parts = url.split('/');
      return parts[parts.length - 1] || '';
    }
  }

  cancelEdition(): void {
    this.resetForm();
  }

  onChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file) {
        this.group.photo = file;
        this.photoName = file.name;
        this.cdr.markForCheck();
      }
    }
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

  // Comparator for the genre select
  compareGenres(genre1: any, genre2: any): boolean {
    if (!genre1 || !genre2) return false;
    
    // Handle both object and primitive comparisons
    const id1 = typeof genre1 === 'object' ? genre1.idMusicGenre : genre1;
    const id2 = typeof genre2 === 'object' ? genre2.idMusicGenre : genre2;
    
    return id1 === id2;
  }

  onGenreChange(genreId: number | null): void {
    console.log('Genre changed to:', genreId);
    this.selectedGenreId = genreId;
    if (genreId !== null) {
      const selectedGenre = this.genres.find(g => g.idMusicGenre === genreId);
      if (selectedGenre) {
        this.group = {
          ...this.group,
          musicGenre: selectedGenre.nameMusicGenre,
          musicGenreId: selectedGenre.idMusicGenre,
          musicGenreName: selectedGenre.nameMusicGenre
        };
      }
    } else {
      this.group = {
        ...this.group,
        musicGenre: '',
        musicGenreId: 0,
        musicGenreName: ''
      };
    }
    console.log('After genre change, selectedGenreId:', this.selectedGenreId);
    this.cdr.markForCheck();
  }

  confirmDelete(group: IGroup): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete ${group.nameGroup}?`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.deleteGroup(group.idGroup);
      }
    });
  }

  private deleteGroup(id: number): void {
    this.loading = true;
    this.cdr.markForCheck();
    
    this.groupsService.deleteGroup(id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.visibleError = false;
        this.getGroups();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error deleting group:', err);
        this.visibleError = true;
        this.errorMessage = 'Failed to delete group. Please try again.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }
}
