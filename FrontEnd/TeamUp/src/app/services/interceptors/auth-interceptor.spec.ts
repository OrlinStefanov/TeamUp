import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { authInterceptor } from './auth-interceptor';
import { Auth } from '../auth/auth';
import { environment } from '../../../environments/environment';

function createToken(expSecondsFromNow: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: 'user-1',
    exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
  }));
  return `${header}.${payload}.signature`;
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: Auth;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    localStorage.clear();
    router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        Auth,
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(Auth);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should retry a protected request after refreshing the token', () => {
    const oldToken = createToken(3600);
    const newToken = createToken(7200);
    localStorage.setItem('token', oldToken);

    http.get(`${environment.apiUrl}/me`).subscribe(response => {
      expect(response).toEqual({ id: 'user-1' });
    });

    const initialReq = httpMock.expectOne(`${environment.apiUrl}/me`);
    expect(initialReq.request.headers.get('Authorization')).toBe(`Bearer ${oldToken}`);
    initialReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne(`${environment.apiUrl}/refresh-token`);
    refreshReq.flush(newToken);

    const retryReq = httpMock.expectOne(`${environment.apiUrl}/me`);
    expect(retryReq.request.headers.get('Authorization')).toBe(`Bearer ${newToken}`);
    retryReq.flush({ id: 'user-1' });

    expect(localStorage.getItem('token')).toBe(newToken);
  });

  it('should log out and redirect when refresh fails', () => {
    localStorage.setItem('token', createToken(3600));

    http.get(`${environment.apiUrl}/workspaces/short`).subscribe({
      next: () => fail('expected request to fail'),
      error: (error: HttpErrorResponse) => {
        expect(error.status).toBe(401);
      },
    });

    const initialReq = httpMock.expectOne(`${environment.apiUrl}/workspaces/short`);
    initialReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    const refreshReq = httpMock.expectOne(`${environment.apiUrl}/refresh-token`);
    refreshReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(localStorage.getItem('token')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    httpMock.expectNone(`${environment.apiUrl}/workspaces/short`);
  });

  it('should not attempt refresh for public auth endpoints', () => {
    http.post(`${environment.apiUrl}/login`, {}).subscribe({
      next: () => fail('expected request to fail'),
      error: (error: HttpErrorResponse) => {
        expect(error.status).toBe(401);
      },
    });

    const loginReq = httpMock.expectOne(`${environment.apiUrl}/login`);
    loginReq.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    httpMock.expectNone(`${environment.apiUrl}/refresh-token`);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
