import { Injectable } from '@angular/core';
import { LoginUser, RegisterUser, ResetUser, UpdateUser, User } from './auth-types';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, finalize, Observable, of, shareReplay, tap } from 'rxjs';


@Injectable({
  providedIn: 'root',
})

export class Auth {
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

  getUserId(): string {
    const user = this.userSubject.value;
    return user?.id || '';
  }

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

  getWorkspaceInfo(id: string, forceRefresh = false): Observable<any> {
    if (forceRefresh) {
      this.workspaceCache.delete(id);
      this.workspaceRequests.delete(id);
    }

    if (!forceRefresh && this.workspaceCache.has(id)) {
      return of(this.workspaceCache.get(id));
    }

    if (!forceRefresh && this.workspaceRequests.has(id)) {
      return this.workspaceRequests.get(id)!;
    }

    const request$ = this.http.get<any>(`${this.apiUrl}/workspace/info/${id}`).pipe(
      tap(data => {
        this.workspaceCache.set(id, data);
        this.updateWorkspaceInList(id, data);
      }),
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
    const fullFromCache = this.workspaceCache.get(id);
    if (fullFromCache) {
      return fullFromCache;
    }

    const fromWorkspaceList = this.workspaceSubject.value.find(w => w.publicId === id);
    if (fromWorkspaceList && this.hasWorkspaceDetails(fromWorkspaceList)) {
      return fromWorkspaceList;
    }

    return undefined;
  }

  private hasWorkspaceDetails(workspace: any): boolean {
    return Array.isArray(workspace?.members) &&
           Array.isArray(workspace?.invitations) &&
           !!workspace?.owner;
  }

  private updateWorkspaceInList(id: string, fullWorkspace: any): void {
    const current = this.workspaceSubject.value;
    const idx = current.findIndex(w => w.publicId === id);

    if (idx === -1) return;

    const updated = [...current];
    updated[idx] = { ...updated[idx], ...fullWorkspace };
    this.workspaceSubject.next(updated);
  }

  createWorkspace(workspace: any) {
    return this.http.post(`${this.apiUrl}/create/workspace`, workspace, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  searchUsers(emailOrUsername: string) {
    return this.http.get(`${this.apiUrl}/search/members?query=${encodeURIComponent(emailOrUsername)}`);
  }

  joinWorkspaceByCode(code: string) {
    return this.http.post(
      `${this.apiUrl}/join/workspace`,
      { join_code: code },
      { withCredentials: true }
    );
  }

  joinWorkspaceByLink(publicId: string) {
    return this.http.post(
      `${this.apiUrl}/workspace/join/link/${publicId}`,
      {},
      { withCredentials: true }
    );
  }

  getChannels(workspacePublicId: number) {
    return this.http.get<any[]>(`${this.apiUrl}/workspace/${workspacePublicId}/get/channels`, {
      withCredentials: true
    });
  }

  createChannel(workspaceId : number, channel : any)
  {
    return this.http.post(`${this.apiUrl}/workspace/${workspaceId}/create/channels`, channel, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' }
    });
  }  

  createTask(data : any)
  {
    return this.http.post(`${this.apiUrl}/create/tasks`, data, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  deleteWorkspace(workspaceId : string)
  {
    return this.http.delete(`${this.apiUrl}/delete/workspace/${workspaceId}`, {
      withCredentials: true
    })
  }

  editWorkspace(workspace : any)
  {
    return this.http.put(`${this.apiUrl}/edit/workspace`, workspace, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  updateTaskStatus(taskId : string, status : number)
  {
    return this.http.put(`${this.apiUrl}/task/status/${taskId}`, { status }, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' }
    })
  };

  getLeaderboard(workspaceId : string)
  {
    return this.http.get(`${this.apiUrl}/leaderboard/${workspaceId}`, {
      withCredentials: true
    })
  }

  addMemberToWorkspace(member : any)
  {
    return this.http.post(`${this.apiUrl}/workspace/add-member`, member, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  changeMemberRole(member : any)
  {
    return this.http.post(`${this.apiUrl}/workspace/change-role`, member, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  removeMemberFromWorkspace(publicId : string, userId : string)
  {
    return this.http.delete(`${this.apiUrl}/workspace/${publicId}/members/${userId}`, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  acceptInvitation(invitationId : string, action : string)
  {
    return this.http.post(`${this.apiUrl}/workspace/invitations/${invitationId}`, { action }, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  uploadProfilePic(file: File) {
    const formData = new FormData();
    formData.append('file', file);
  
    return this.http.post(`${this.apiUrl}/upload-profile-picture`, formData, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`
      }
    });
  }

  updateUserInfo(user : UpdateUser)
  {
    return this.http.post(`${this.apiUrl}/profile/update`, user, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  //-----------------------Decoding the token--------------------------------------------
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  decodeToken(token: string): User {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));

    return {
      id: payload.sub ?? 
          payload.nameid ?? 
          payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ?? '',

      username: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ?? 
                payload.unique_name ?? 
                payload.name ?? '',

      email: payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ?? 
             payload.email ?? '',

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