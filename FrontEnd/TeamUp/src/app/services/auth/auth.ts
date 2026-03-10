import { Injectable } from '@angular/core';
import { LoginUser, RegisterUser, User } from './auth-types';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';


@Injectable({
  providedIn: 'root',
})

export class Auth {
  public getUserId: any;
  public me_credentials: any;
  
  constructor(private http: HttpClient) {
    this.loadUserFromStorage();
  };

  private apiUrl = 'https://localhost:7094';
  private tokenKey = 'token';
  private userSubject = new BehaviorSubject<any | null>(null);
  user$ = this.userSubject.asObservable();

  login(user : LoginUser)
  {
    return this.http.post<{ token: string }>(`${this.apiUrl}/login`, user, { withCredentials: true, headers: { 'Content-Type': 'application/json' } });
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    this.userSubject.next(null);
    return this.http.post(`${this.apiUrl}/logout`, { withCredentials: true, headers: { 'Content-Type': 'application/json' } }, {  });
  }

  register(user: RegisterUser) {
    return this.http.post(`${this.apiUrl}/register`, user, { withCredentials: true, headers: { 'Content-Type': 'application/json' } });
  }

  //returns the user information based on the token
  me()
  {
    return this.http.get(`${this.apiUrl}/me`, { withCredentials: true, headers: { 'Content-Type': 'application/json' } });
  }

  //-----------------------Decoding the token--------------------------------------------
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  decodeToken(token: string): User {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));

      return {
        id: payload.jti ?? '',
        username: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ?? 
                  payload.unique_name ?? 
                  payload.name ?? '',
        
        email: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ?? 
              payload.email ?? '',

      /*  roles: payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
          ? [payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']]
          : [],*/

        exp: payload.exp ?? 0
      };
    } catch {
      return { id: '', email: '', username:'', exp: 0 };
    }
  }

  loadUserFromStorage(): void {
    const token = this.getToken();
    if (!token) return;

    const user = this.decodeToken(token);
    if (Date.now() >= user.exp * 1000) {
      this.logout(); // token expired
    } else {
      this.userSubject.next(user);
    }
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    const user = this.decodeToken(token);
    return Date.now() < user.exp * 1000;
  }

  hasRole(role: string): boolean {
    const user = this.userSubject.value;
    return user?.roles.includes(role) ?? false;
  }
}
