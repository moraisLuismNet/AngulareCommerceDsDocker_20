import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { IUser } from '../EcommerceInterface';
import { environment } from 'src/environments/environment';
import { AuthGuard } from '../../guards/AuthGuardService';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly urlAPI = environment.urlAPI;

  private readonly http = inject(HttpClient);
  private readonly authGuard = inject(AuthGuard);

  private getHeaders(): HttpHeaders {
    const token = this.authGuard.getToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  getUsers(): Observable<IUser[]> {
    const headers = this.getHeaders();
    return this.http.get<IUser[]>(`${this.urlAPI}Users`, { headers }).pipe(
      map((response) => {
        // The API returns the array directly, no need to access .$values
        return Array.isArray(response) ? response : [];
      }),
      catchError((error) => {
        console.error('Error in the request:', error);
        return of([]);
      })
    );
  }

  deleteUser(email: string): Observable<any> {
    const headers = this.getHeaders();
    return this.http.delete(
      `${this.urlAPI}Users/${encodeURIComponent(email)}`,
      { headers }
    );
  }
}
