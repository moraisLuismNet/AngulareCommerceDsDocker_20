import { Component, OnInit, OnDestroy, afterNextRender, inject, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { ILogin, ILoginResponse } from 'src/app/interfaces/LoginInterface';
import { AppService } from 'src/app/services/AppService';
import { AuthGuard } from 'src/app/guards/AuthGuardService';
import { UserService } from 'src/app/services/UserService';
import { jwtDecode } from 'jwt-decode';

@Component({
    selector: 'app-login',
    imports: [
        CommonModule,
        FormsModule,
        RouterModule,
        ButtonModule,
        InputTextModule,
        PasswordModule,
        ToastModule
    ],
    templateUrl: './LoginComponent.html',
    styleUrl: './LoginComponent.css',
    providers: [MessageService],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit, OnDestroy {
  // Injected services
  private readonly router = inject(Router);
  private readonly appService = inject(AppService);
  private readonly messageService = inject(MessageService);
  private readonly authGuard = inject(AuthGuard);
  private readonly userService = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  
  loading = false;
  
  infoLogin: ILogin = {
    email: '',
    password: '',
    role: '',
  };
  constructor() {
    // One-time initialization after the first render
    afterNextRender(() => {
      // Any DOM-dependent initialization can go here
      this.userService.setEmail(this.infoLogin.email);
    });
  }

  ngOnInit() {
    if (this.authGuard.isLoggedIn()) {
      this.router.navigateByUrl('/ecommerce/listgroups');
      return;
    }
    this.cdr.markForCheck();
  }

  login() {
    if (this.loading) return;
    
    this.loading = true;
    this.cdr.markForCheck();
    
    this.appService.login(this.infoLogin).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (data: ILoginResponse) => {
        const decodedToken: any = jwtDecode(data.token);
        const role =
          decodedToken[
            'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'
          ];
        sessionStorage.setItem('user', JSON.stringify({ ...data, role }));
        this.userService.setEmail(this.infoLogin.email);
        this.userService.setRole(role);
        
        this.loading = false;
        this.cdr.markForCheck();
        
        // Navigate based on user role
        this.userService.redirectBasedOnRole();
      },
      error: (err) => {
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Login failed. Please check your credentials.',
        });
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }
}
