import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ILoginResponse } from '../interfaces/LoginInterface';
import { jwtDecode } from 'jwt-decode';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard {
  private readonly router = inject(Router);

  getRole(): string {
    const userData = sessionStorage.getItem('user');
    if (userData) {
      const user: ILoginResponse = JSON.parse(userData);
      return user.role || '';
    }
    return '';
  }

  isLoggedIn(): boolean {
    return !!sessionStorage.getItem('user');
  }

  getUser(): string {
    const infoUser = sessionStorage.getItem('user');
    if (infoUser) {
      const userInfo: ILoginResponse = JSON.parse(infoUser);
      return userInfo.email;
    }
    return '';
  }

  getToken(): string {
    const infoUser = sessionStorage.getItem('user');
    if (infoUser) {
      const userInfo: ILoginResponse = JSON.parse(infoUser);
      return userInfo.token;
    }
    return '';
  }

  getCartId(): number | null {
    const token = this.getToken();
    if (token) {
      try {
        const decodedToken: any = jwtDecode(token);
        const cartId = decodedToken['CartId'];
        return cartId !== undefined ? Number(cartId) : null;
      } catch (error) {
        console.error('Error decoding token:', error);
        return null;
      }
    }
    return null;
  }
}
