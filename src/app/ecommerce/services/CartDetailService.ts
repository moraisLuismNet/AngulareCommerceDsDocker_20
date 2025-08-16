import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  catchError,
  Observable,
  of,
  tap,
  map,
  throwError,
  switchMap,
} from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthGuard } from '../../guards/AuthGuardService';
import { ICartDetail, IRecord } from '../EcommerceInterface';
import { UserService } from 'src/app/services/UserService';
import { StockService } from './StockService';
import { RecordsService } from './RecordsService';

@Injectable({
  providedIn: 'root',
})
export class CartDetailService {
  private readonly http = inject(HttpClient);
  private readonly authGuard = inject(AuthGuard);
  private readonly userService = inject(UserService);
  private readonly stockService = inject(StockService);
  private readonly recordsService = inject(RecordsService);

  readonly urlAPI = environment.urlAPI;
  private cart: IRecord[] = [];

  getCartItemCount(email: string): Observable<any> {
    // Verify that the email matches the current user
    if (this.userService.email !== email) {
      return of({ totalItems: 0 });
    }
    return this.http
      .get(`${this.urlAPI}CartDetails/getCartItemCount/${email}`)
      .pipe(
        catchError((error) => {
          console.error('Error getting cart item count:', error);
          return of({ totalItems: 0 });
        })
      );
  }

  getCartDetails(email: string): Observable<any> {
    return this.http
      .get(`${this.urlAPI}cartDetails/getCartDetails/${email}`)
      .pipe(
        catchError((error) => {
          console.error('Error getting cart details:', error);
          return of([]);
        })
      );
  }

  getRecordDetails(recordId: number): Observable<IRecord | null> {
    return this.http.get<IRecord>(`${this.urlAPI}records/${recordId}`).pipe(
      catchError((error) => {
        console.error('Error getting record details:', error);
        return of(null);
      })
    );
  }

  addToCartDetail(
    email: string,
    recordId: number,
    amount: number
  ): Observable<any> {
    const headers = this.getHeaders();
    return this.http
      .post(
        `${this.urlAPI}CartDetails/addToCartDetailAndCart/${encodeURIComponent(
          email
        )}?recordId=${recordId}&amount=${amount}`,
        {},
        { headers }
      )
      .pipe(
        switchMap(() => {
          return this.recordsService.getRecordById(recordId);
        }),
        tap((updatedRecord: IRecord) => {
          if (updatedRecord) {
            this.stockService.notifyStockUpdate(recordId, updatedRecord.stock);
            return {
              ...updatedRecord,
              stock: updatedRecord.stock,
              amount: amount,
            };
          } else {
            console.error('[CartDetailService] No updated record received');
            return throwError(() => new Error('Failed to get updated record'));
          }
        }),
        catchError((error) => {
          console.error('[CartDetailService] Error in addToCartDetail:', error);
          return throwError(() => error);
        })
      );
  }

  removeFromCartDetail(
    email: string,
    recordId: number,
    amount: number
  ): Observable<any> {
    if (!email || !recordId) {
      return throwError(() => new Error('Invalid parameters'));
    }

    const headers = this.getHeaders();
    return this.http
      .post(
        `${
          this.urlAPI
        }CartDetails/removeFromCartDetailAndCart/${encodeURIComponent(
          email
        )}?recordId=${recordId}&amount=${amount}`,
        {},
        { headers }
      )
      .pipe(
        switchMap(() => {
          return this.recordsService.getRecordById(recordId);
        }),
        tap((updatedRecord: IRecord) => {
          if (updatedRecord) {
            this.stockService.notifyStockUpdate(recordId, updatedRecord.stock);
            return {
              ...updatedRecord,
              stock: updatedRecord.stock,
              amount: -amount,
            };
          } else {
            return throwError(() => new Error('Failed to get updated record'));
          }
        }),
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }

  addAmountCartDetail(detail: ICartDetail): Observable<ICartDetail> {
    return this.http.put<ICartDetail>(
      `${this.urlAPI}CartDetails/${detail.idCartDetail}`,
      detail
    );
  }

  updateRecordStock(recordId: number, change: number): Observable<IRecord> {
    if (typeof change !== 'number' || isNaN(change)) {
      return throwError(() => new Error('Invalid stock change value'));
    }

    return this.http
      .put<any>(
        `${this.urlAPI}records/${recordId}/updateStock/${change}`,
        {},
        { headers: this.getHeaders() }
      )
      .pipe(
        tap((response) => {
          const newStock = response?.newStock;
          if (typeof newStock === 'number' && newStock >= 0) {
            this.stockService.notifyStockUpdate(recordId, newStock);
          } else {
            throw new Error('Received invalid stock value from server');
          }
        }),
        map(
          (response) =>
            ({
              idRecord: recordId,
              stock: response.newStock,
              titleRecord: '',
              yearOfPublication: null,
              imageRecord: null,
              photo: null,
              price: 0,
              discontinued: false,
              groupId: null,
              groupName: '',
              nameGroup: '',
            } as IRecord)
        ),
        catchError((error) => {
          return throwError(
            () => new Error('Failed to update stock. Please try again.')
          );
        })
      );
  }

  getHeaders(): HttpHeaders {
    const token = this.authGuard.getToken();
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    return headers;
  }

  incrementQuantity(detail: ICartDetail): Observable<ICartDetail> {
    const previousAmount = detail.amount;
    detail.amount++;
    return new Observable((observer) => {
      this.addAmountCartDetail(detail).subscribe({
        next: () => {
          this.updateRecordStock(detail.recordId, -1).subscribe({
            next: () => {
              observer.next(detail);
              observer.complete();
            },
            error: (err) => {
              detail.amount = previousAmount;
              observer.error(err);
            },
          });
        },
        error: (err) => {
          detail.amount = previousAmount;
          observer.error(err);
        },
      });
    });
  }

  decrementQuantity(detail: ICartDetail): Observable<ICartDetail> {
    if (detail.amount <= 1) {
      // Do not allow quantities less than 1
      return of(detail); // Return the detail without changes
    }
    const previousAmount = detail.amount;
    detail.amount--;
    return new Observable((observer) => {
      this.addAmountCartDetail(detail).subscribe({
        next: () => {
          this.updateRecordStock(detail.recordId, 1).subscribe({
            next: () => {
              observer.next(detail);
              observer.complete();
            },
            error: (err) => {
              detail.amount = previousAmount;
              observer.error(err);
            },
          });
        },
        error: (err) => {
          detail.amount = previousAmount;
          observer.error(err);
        },
      });
    });
  }

  getCartDetailsByEmail(email: string): Observable<ICartDetail[]> {
    return this.http.get<ICartDetail[]>(
      `${this.urlAPI}cartdetails/getCartDetails/${email}`
    );
  }
}
