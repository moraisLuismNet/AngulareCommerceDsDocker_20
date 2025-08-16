import { Component, OnDestroy, afterNextRender, inject, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';

import { IRegister } from 'src/app/interfaces/RegisterInterface';
import { AppService } from 'src/app/services/AppService';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-register',
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        ButtonModule,
        InputTextModule,
        PasswordModule,
        CardModule,
        ToastModule
    ],
    templateUrl: './RegisterComponent.html',
    styleUrl: './RegisterComponent.css',
    providers: [MessageService],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent implements OnDestroy {
  usuario: IRegister = { email: '', password: '' };
  registrationError: string | null = null;
  // Injected services
  private readonly appService = inject(AppService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  
  isSubmitting = false;

  constructor() {
    // One-time initialization after the first render
    afterNextRender(() => {
      // DOM-dependent initialization can go here
    });
  }

  onSubmit(form: any): void {
    if (!form.valid || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    this.registrationError = null;
    this.cdr.markForCheck();
    
    this.appService.register(this.usuario).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Registration successful! Redirecting to login...',
        });
        
        // Navigate to login after showing success message
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1500);
      },
      error: (err) => {
        console.error('Error registering user:', err);
        this.registrationError = 'The user could not be registered. Please try again.';
        this.messageService.add({
          severity: 'error',
          summary: 'Registration error',
          detail: this.registrationError,
        });
        this.isSubmitting = false;
        this.cdr.markForCheck();
      },
      complete: () => {
        this.isSubmitting = false;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    // No need to manually unsubscribe thanks to takeUntilDestroyed
  }
}
