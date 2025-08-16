import { Injectable, inject, DestroyRef } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserService } from 'src/app/services/UserService';
import { IRecord, ICart } from '../EcommerceInterface';
import { CartDetailService } from './CartDetailService';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { AuthGuard } from 'src/app/guards/AuthGuardService';
import { StockService } from './StockService';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly urlAPI = environment.urlAPI;
  private readonly cart: IRecord[] = [];
  private cartSubject = new BehaviorSubject<IRecord[]>([]);
  private cartItemCountSubject = new BehaviorSubject<number>(0);
  readonly cartItemCount$ = this.cartItemCountSubject.asObservable();
  readonly cart$ = this.cartSubject.asObservable();
  private cartTotalSubject = new BehaviorSubject<number>(0);
  readonly cartTotal$ = this.cartTotalSubject.asObservable();
  cartEnabledSubject = new BehaviorSubject<boolean>(true);
  readonly cartEnabled$ = this.cartEnabledSubject.asObservable();
  
  private readonly destroyRef = inject(DestroyRef);

  private readonly httpClient = inject(HttpClient);
  private readonly authGuard = inject(AuthGuard);
  private readonly userService = inject(UserService);
  private readonly cartDetailService = inject(CartDetailService);
  private readonly stockService = inject(StockService);

  constructor() {
    this.initializeCart();
  }

  private initializeCart(): void {
    this.setupUserSubscription();
  }

  private setupUserSubscription(): void {
    this.userService.emailUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (email) => {
          if (email) {
            this.initializeCartForUser(email);
          } else {
            this.resetCart();
          }
        },
        error: (err) => console.error('Error subscribing to emailUser$:', err)
      });
  }

  private initializeCartForUser(email: string): void {
    // First we synchronize with the backend
    this.syncCartWithBackend(email);
    
    // Then we load from localStorage only if there is no data from the backend
    const savedCart = this.getCartForUser(email);
    if (savedCart && savedCart.length > 0) {
      const totalItems = savedCart.reduce((sum, item) => sum + (item.amount || 1), 0);
      const totalPrice = savedCart.reduce((sum, item) => sum + ((item.price || 0) * (item.amount || 1)), 0);
      
      this.cartSubject.next([...savedCart]);
      this.cartItemCountSubject.next(totalItems);
      this.cartTotalSubject.next(totalPrice);
    }
  }

  resetCart(): void {
    this.cartSubject.next([]);
    this.cartItemCountSubject.next(0);
    this.cartTotalSubject.next(0);
  }

  private updateCartState(cartItems: IRecord[]): void {
    this.cartSubject.next(cartItems);
    this.cartItemCountSubject.next(
      cartItems.reduce((total, item) => total + (Number(item.amount) || 1), 0)
    );
    this.calculateAndUpdateLocalTotal();
    this.saveCartForUser(this.userService.email || '', cartItems);
  }

  private shouldSyncCart(email: string | null): boolean {
    // Check all necessary conditions
    return (
      !!email && this.cartEnabledSubject.value && this.authGuard.isLoggedIn()
    );
  }
  syncCartWithBackend(email: string): void {
    if (!email) {
      console.log('Unable to sync cart: email not provided');
      return;
    }
    
    this.cartDetailService
      .getCartDetails(email)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          // Handle different response formats
          let cartDetails = [];
          if (Array.isArray(response)) {
            cartDetails = response;
          } else if (response?.$values && Array.isArray(response.$values)) {
            cartDetails = response.$values;
          } else if (response) {
            // If it's a single object, convert it to an array
            cartDetails = [response];
          }
          
          // Map the cart details to the expected format
          const updatedCart = cartDetails.map((detail: any) => {
            const item = {
              ...detail,
              amount: Number(detail.amount) || 1,
              inCart: true,
              idRecord: detail.recordId || detail.idRecord,
              price: Number(detail.price) || 0,
              title: detail.titleRecord || detail.title || 'Untitled',
              image: detail.imageRecord || detail.image || '',
              stock: detail.stock || 0,
            };
            return item;
          });
          
          // Calculate total items summing the quantities
          const totalItems = updatedCart.reduce(
            (total: number, item: any) => total + (Number(item.amount) || 0),
            0
          );

          // Calculate cart total
          const cartTotal = updatedCart.reduce(
            (total: number, item: any) => 
              total + (Number(item.price) || 0) * (Number(item.amount) || 0),
            0
          );
          
          // Update states atomically
          this.cartSubject.next([...updatedCart]);
          this.cartItemCountSubject.next(totalItems);
          this.cartTotalSubject.next(cartTotal);
          
          // Save in localStorage
          this.saveCartForUser(email, updatedCart);
        },
        error: (error) => {
          console.error('Error syncing cart with backend:', error);
          // No reset the cart in case of error, maintain the current state
          console.log('Maintaining the current cart state');
        }
      });
  }

  addToCart(record: IRecord): Observable<any> {
    const userEmail = this.userService.email;
    if (!userEmail) return throwError(() => new Error('Unauthenticated user'));

    return this.cartDetailService
      .addToCartDetail(userEmail, record.idRecord, 1)
      .pipe(
        tap((updatedRecord: any) => {
          // Get current cart
          const currentCart = this.cartSubject.value;

          // Update the cart item
          const existingItem = currentCart.find(
            (item) => item.idRecord === record.idRecord
          );
          if (existingItem) {
            existingItem.amount = (existingItem.amount || 0) + 1;
            existingItem.stock = updatedRecord?.stock || existingItem.stock;
          } else {
            currentCart.push({
              ...record,
              amount: 1,
              inCart: true,
              stock: updatedRecord?.stock || record.stock,
            });
          }

          // Update cart state
          this.updateCartState(currentCart);
          this.stockService.notifyStockUpdate(
            record.idRecord,
            updatedRecord?.stock
          );
        }),
        catchError((error) => {
          console.error('Error adding to cart:', error);
          return throwError(() => error);
        })
      );
  }

  removeFromCart(record: IRecord): Observable<any> {
    const userEmail = this.userService.email;
    if (!userEmail) {
      return throwError(() => new Error('Unauthenticated user'));
    }
    return this.cartDetailService
      .removeFromCartDetail(userEmail, record.idRecord, 1)
      .pipe(
        tap((updatedRecord: any) => {
          // Get current cart
          const currentCart = this.cartSubject.value;
          // Update the cart item
          const existingItem = currentCart.find(
            (item) => item.idRecord === record.idRecord
          );
          if (existingItem) {
            existingItem.amount = Math.max(0, (existingItem.amount || 0) - 1);
            existingItem.stock = updatedRecord?.stock || existingItem.stock;
            // Remove item if amount reaches 0
            if (existingItem.amount === 0) {
              const index = currentCart.indexOf(existingItem);
              if (index !== -1) {
                currentCart.splice(index, 1);
              }
            }
          }
          // Update cart state
          this.updateCartState(currentCart);
          this.stockService.notifyStockUpdate(
            record.idRecord,
            updatedRecord?.stock
          );
        }),
        catchError((error) => {
          console.error('Error removing from cart:', error);
          return throwError(() => error);
        })
      );
  }

  updateCartNavbar(itemCount: number, totalPrice: number): void {
    // Update the cart items to reflect the new counts
    const currentCart = this.cartSubject.value;
    const updatedCart = [...currentCart];
    
    // Update the cart subject with the current items (or empty array if no items)
    this.cartSubject.next(updatedCart);
    
    // Update the count and total subjects
    this.cartItemCountSubject.next(itemCount);
    this.cartTotalSubject.next(totalPrice);
    
    // Save to local storage if user is logged in
    if (this.userService.email) {
      this.saveCartForUser(this.userService.email, updatedCart);
    }
  }

  getCartForUser(email: string): IRecord[] {
    const cartJson = localStorage.getItem(`cart_${email}`);
    return cartJson ? JSON.parse(cartJson) : [];
  }

  getCartItems(): Observable<IRecord[]> {
    return this.cart$;
  }

  saveCartForUser(email: string, cart: IRecord[]): void {
    localStorage.setItem(`cart_${email}`, JSON.stringify(cart));
  }

  updateCartItem(record: IRecord): void {
    const currentCart = this.cartSubject.value;
    const index = currentCart.findIndex(
      (item) => item.idRecord === record.idRecord
    );

    if (index !== -1) {
      currentCart[index] = { ...record };
      this.cartSubject.next([...currentCart]);
      this.updateCartCount(currentCart);
      this.calculateAndUpdateLocalTotal();
      this.saveCartForUser(this.userService.email || '', currentCart);
    }
  }

  getCart(email: string): Observable<ICart> {
    const headers = this.getHeaders();
    return this.httpClient
      .get<ICart>(`${this.urlAPI}Carts/${email}`, { headers })
      .pipe(
        catchError((error) => {
          console.error('Error getting cart:', error);
          return this.httpClient.get<ICart>(
            `${this.urlAPI}Carts/GetCartByEmail/${email}`,
            { headers }
          );
        })
      );
  }

  private getHeaders(): HttpHeaders {
    const token = this.authGuard.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  // No need for ngOnDestroy when using takeUntilDestroyed

  getAllCarts(): Observable<ICart[]> {
    const headers = this.getHeaders();
    return this.httpClient
      .get<ICart[]>(`${this.urlAPI}Carts`, { headers })
      .pipe(
        catchError((error) => {
          console.error('Error getting all carts:', error);
          return throwError(() => error);
        })
      );
  }

  disableCart(email: string): Observable<ICart> {
    const headers = this.getHeaders();
    return this.httpClient
      .post<ICart>(`${this.urlAPI}Carts/Disable/${email}`, {}, { headers })
      .pipe(
        tap((disabledCart) => {
          // Update local status immediately
          const currentCart = this.cartSubject.value;
          const updatedCart = currentCart.map((item) => ({
            ...item,
            price: 0,
            amount: 0, 
          }));
          this.updateCartState(updatedCart);
        }),
        catchError((error) => {
          console.error('Error disabling cart:', error);
          return throwError(() => error);
        })
      );
  }

  enableCart(email: string): Observable<any> {
    const headers = this.getHeaders();
    return this.httpClient
      .post(`${this.urlAPI}Carts/Enable/${email}`, {}, { headers })
      .pipe(
        catchError((error) => {
          console.error('Error enabling cart:', error);
          return throwError(() => error);
        })
      );
  }

  private updateCartCount(cart: IRecord[]): void {
    const totalItems = cart.reduce(
      (total: number, item: IRecord) => total + (item.amount || 1),
      0
    );
    this.cartItemCountSubject.next(totalItems);
  }

  private calculateAndUpdateLocalTotal(): void {
    const total = this.cartSubject.value.reduce(
      (sum: number, item: IRecord) => {
        const price = Number(item.price) || 0;
        const amount = Number(item.amount) || 1;
        return sum + price * amount;
      },
      0
    );
    this.cartTotalSubject.next(total);
  }

  getCartStatus(email: string): Observable<{ enabled: boolean }> {
    const headers = this.getHeaders();
    return this.httpClient
      .get<{ enabled: boolean }>(
        `${this.urlAPI}Carts/GetCartStatus/${encodeURIComponent(email)}`,
        { headers }
      )
      .pipe(
        catchError((error) => {
          console.error('Error getting cart status:', error);
          if (error.status === 404) {
            return of({ enabled: true });
          }
          return of({ enabled: false });
        })
      );
  }
}
