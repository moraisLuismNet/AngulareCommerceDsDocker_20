import { Component, OnInit, ViewChild, inject, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef } from '@angular/core';
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
import { IGenre } from '../EcommerceInterface';
import { GenresService } from '../services/GenresService';

@Component({
    selector: 'app-genres',
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        InputTextModule,
        TableModule,
        ToastModule,
        DialogModule,
        ConfirmDialogModule
    ],
    templateUrl: './GenresComponent.html',
    providers: [ConfirmationService],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class GenresComponent implements OnInit {
  // Injected services
  private readonly genresService = inject(GenresService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  
  @ViewChild('form') form!: NgForm;
  visibleError = false;
  errorMessage = '';
  genres: IGenre[] = [];
  filteredGenres: IGenre[] = [];
  visibleConfirm = false;
  searchTerm: string = '';

  genre: IGenre = {
    idMusicGenre: 0,
    nameMusicGenre: '',
  };

  ngOnInit(): void {
    this.getGenres();
  }

  getGenres() {
    this.genresService.getGenres().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data: any) => {
        this.visibleError = false;
        // The API returns the array directly, no need to access .$values
        this.genres = Array.isArray(data) ? [...data] : [];
        this.filteredGenres = [...this.genres]; // Initialize `filteredGenres` as a copy of `genres`
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error:', err);
        this.visibleError = true;
        this.controlError(err);
        this.cdr.markForCheck();
      },
    });
  }
  save() {
    const genreOperation = this.genre.idMusicGenre === 0
      ? this.genresService.addGenre(this.genre)
      : this.genresService.updateGenre(this.genre);

    genreOperation.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.visibleError = false;
        this.form.reset();
        if (this.genre.idMusicGenre !== 0) {
          this.cancelEdition();
        }
        this.getGenres();
      },
      error: (err) => {
        console.error('Error saving genre:', err);
        this.visibleError = true;
        this.controlError(err);
        this.cdr.markForCheck();
      },
    });
  }

  edit(genre: IGenre) {
    this.genre = { ...genre };
  }

  cancelEdition() {
    this.genre = {
      idMusicGenre: 0,
      nameMusicGenre: '',
    };
  }

  confirmDelete(genre: IGenre) {
    this.confirmationService.confirm({
      message: `Delete the genre ${genre.nameMusicGenre}?`,
      header: 'Are you sure?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Yes',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteGenre(genre.idMusicGenre!),
    });
  }

  deleteGenre(id: number) {
    this.genresService.deleteGenre(id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.visibleError = false;
        this.form.reset({ name: '' });
        this.getGenres();
      },
      error: (err) => {
        this.visibleError = true;
        this.controlError(err);
        this.cdr.markForCheck();
      },
    });
  }

  filterGenres() {
    const term = this.searchTerm.toLowerCase();
    this.filteredGenres = this.genres.filter((genre) =>
      genre.nameMusicGenre.toLowerCase().includes(term)
    );
    this.cdr.markForCheck();
  }
  controlError(err: any) {
    if (err.error && typeof err.error === 'object' && err.error.message) {
      this.errorMessage = err.error.message;
    } else if (typeof err.error === 'string') {
      this.errorMessage = err.error;
    } else if (err.message) {
      this.errorMessage = err.message;
    } else {
      this.errorMessage = 'An unexpected error has occurred';
    }
    this.cdr.markForCheck();
  }
}
