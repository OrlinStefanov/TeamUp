import { Injectable } from '@angular/core';
import { LoginUser, RegisterUser, ResetUser, User } from './auth-types';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';


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
  private currentWorkspace = new BehaviorSubject< any | null>(null);

  workspace$ = this.currentWorkspace.asObservable();
  user$ = this.userSubject.asObservable();

  setWorkspace(w : any)
  {
    this.currentWorkspace.next(w);
  }

  getWorkspace()
  {
    return this.currentWorkspace.value;
  }

  setUser(user : any)
  {
    this.userSubject.next(user);
  }

  getCurrentUser() {
    return this.userSubject.value;
  }

  login(user : LoginUser)
  {
    return this.http.post<{ token: string }>(`${this.apiUrl}/login`, user, { withCredentials: true, headers: { 'Content-Type': 'application/json' } }).pipe(
      // Store the token and update user state on successful login
      tap(response => {
        const _token = response.token;
        if (_token)
        {
          localStorage.setItem(this.tokenKey, _token);
          const decodedUser = this.decodeToken(_token);
          this.userSubject.next(decodedUser);
        }
      })
    );
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
    this.me_credentials = this.decodeToken(this.getToken()!);
    this.userSubject.next(this.me_credentials);
    return this.http.get(`${this.apiUrl}/me`, { withCredentials: true, headers: { 'Content-Type': 'application/json' } });
  }

  //forgot password
  forgotPassword(emailOrUsername: string) {
    return this.http.post(`${this.apiUrl}/forgot-password`, { emailOrUsername }, { withCredentials: true, headers: { 'Content-Type': 'application/json' } });
  }

  //reset password
  resetPassword(user : ResetUser)
  {
    return this.http.post(`${this.apiUrl}/reset-password`, user, { withCredentials: true, headers: { 'Content-Type': 'application/json' } });
  }

  //workspace related 
  getWorkspaces() {
    return this.http.get(`${this.apiUrl}/workspaces/short`, { withCredentials: true, headers: { 'Content-Type': 'application/json' } });
  }

  getfullworkspaceInfo(workspaceId: string) {
    return this.http.get(`${this.apiUrl}/workspace/info/${workspaceId}`, { withCredentials: true, headers: { 'Content-Type': 'application/json' } });
  }

  getWorkspaceTasks(workspaceId: string) {
    return this.http.get(`${this.apiUrl}/tasks/${workspaceId}`, { withCredentials: true, headers: { 'Content-Type': 'application/json' } });
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

  isDarkMode(): boolean {
    const saved = localStorage.getItem('darkMode');

    if (saved !== null) {
      return saved === 'true';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  setDarkMode(value: boolean) {
    localStorage.setItem('darkMode', String(value));
  }
}