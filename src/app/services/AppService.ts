import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { ILogin, ILoginResponse } from '../interfaces/LoginInterface';
import { IRegister } from '../interfaces/RegisterInterface';

@Injectable({
  providedIn: 'root',
})
export class AppService {
  private readonly http = inject(HttpClient);
  readonly urlAPI = environment.urlAPI;

  login(credentials: ILogin): Observable<ILoginResponse> {
    return this.http.post<ILoginResponse>(
      `${this.urlAPI}auth/login`,
      credentials
    );
  }

  register(user: IRegister) {
    return this.http.post<any>(`${this.urlAPI}auth/register`, user);
  }
}
