import { Injectable } from '@angular/core';
import { LoginUser, RegisterUser, ResetUser, User } from './auth-types';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, finalize, Observable, of, shareReplay, tap } from 'rxjs';


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

  private workspaceSubject = new BehaviorSubject<any[]>([]);
  workspaces$ = this.workspaceSubject.asObservable();

  private workspaceCache = new Map<string, any>();
  private tasksCache = new Map<string, any[]>();

  // prevent duplicate calls (important)
  private workspaceRequests = new Map<string, Observable<any>>();
  private taskRequests = new Map<string, Observable<any>>();

  login(user: LoginUser) {
    return this.http.post<{ token: string }>(`${this.apiUrl}/login`, user).pipe(
      tap(res => {
        localStorage.setItem(this.tokenKey, res.token);
        this.userSubject.next(this.decodeToken(res.token));
      })
    );
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    this.userSubject.next(null);

    this.workspaceCache.clear();
    this.tasksCache.clear();
    this.workspaceSubject.next([]);

    return this.http.post(`${this.apiUrl}/logout`, {});
  }

  setUser(user : any)
  {
    this.userSubject.next(user);
  }

  getCurrentUser() {
    return this.userSubject.value;
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
  getWorkspaces(forceRefresh = false): Observable<any[]> {
    if (!forceRefresh && this.workspaceSubject.value.length > 0) {
      return of(this.workspaceSubject.value);
    }

    return this.http.get<any[]>(`${this.apiUrl}/workspaces/short`).pipe(
      tap(ws => this.workspaceSubject.next(ws)),
      shareReplay(1)
    );
  }

  getWorkspaceInfo(id: string): Observable<any> {
    if (this.workspaceCache.has(id)) {
      return of(this.workspaceCache.get(id));
    }

    if (this.workspaceRequests.has(id)) {
      return this.workspaceRequests.get(id)!;
    }

    const request$ = this.http.get(`${this.apiUrl}/workspace/info/${id}`).pipe(
      tap(data => this.workspaceCache.set(id, data)),
      finalize(() => this.workspaceRequests.delete(id)),
      shareReplay(1)
    );

    this.workspaceRequests.set(id, request$);
    return request$;
  }

  getWorkspaceTasks(id: string): Observable<any[]> {
    if (this.tasksCache.has(id)) {
      return of(this.tasksCache.get(id)!);
    }

    if (this.taskRequests.has(id)) {
      return this.taskRequests.get(id)!;
    }

    const request$ = this.http.get<any[]>(`${this.apiUrl}/tasks/${id}`).pipe(
      tap(tasks => this.tasksCache.set(id, tasks)),
      finalize(() => this.taskRequests.delete(id)),
      shareReplay(1)
    );

    this.taskRequests.set(id, request$);
    return request$;
  }

  getCachedWorkspaceById(id: string): any | undefined {
    return this.workspaceSubject.value.find(w => w.publicId === id);
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